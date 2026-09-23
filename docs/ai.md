# Findly AI 链路说明

> 维护人：@james-wu66 ｜ 首版 2026-09-23，代码基准 main = `4154a49`
> 涉及文件：`server/src/ai/{ai.controller,ai.service,dto}.ts`、`server/src/search/search.service.ts`、`server/src/stats/stats.service.ts`
> 本文讲**链路和口径**；接口字段以 `docs/api.md`（v1.7）为准，表结构以 `docs/database.md` 为准。

## 1. 接了什么模型

| 用途 | 模型 | 调用点 | 上限 |
|---|---|---|---|
| 识图 | `qwen-vl-plus` | `AiService.recognize` | `max_tokens` 500 |
| 搜索句解析 | `qwen-turbo` | `AiService.parseQuery` | `max_tokens` 200 |

两者都走阿里云百炼 DashScope 的 **OpenAI 兼容模式**（`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`），HTTP 超时 30 秒。
模型名从环境变量读（`QWEN_VL_MODEL` / `QWEN_TEXT_MODEL`），**换模型只改 `.env`，不动代码**。

## 2. 识图链路（一次调用发生了什么）

```
前端拍照 → POST /ai/recognize { imageBase64 }
  ①  格式校验    必须是 data:image/(png|jpe?g|webp);base64, 开头        → 否则 400
  ②  体积硬限    base64.length × 0.75 > 4MB                             → 否则 413
  ③  缓存查      key = sha256(userId + '|' + dataURL)，TTL 24h
                  命中 ⇒ 直接返回，带 cached:true，usage = null，零模型调用
  ④  模型调用    chat(qwen-vl-plus, [图+提示词], max_tokens 500)
  ⑤  输出容错    extractJson：剥 ```json 围栏 → 取第一个 { 到最后一个 } → JSON.parse
                  失败 ⇒ 400 + 友好文案（"暂时无法准确识别…你可以手动填写名称"），不是 500
  ⑥  落库        AIResult(userId, taskType=recognize, model, resultJson 含 usage)
  ⑦  返回        识别结果 + aiResultId
前端确认/编辑 → POST /items { ..., aiResultId }
  ⑧  回填        updateMany where { id, itemId: null, userId } ← 三个条件缺一不可（C14）
物品详情页 → GET /items/:id
  ⑨  装载        aiResults: { where: { userId }, orderBy createdAt desc, take 5 }
```

三个容易踩的实现取舍：

- **缓存 key 掺了 `userId`**。识图结果只由图片决定，纯内容哈希命中率更高，但会跨用户命中 —— 别人传同一张图就能拿到你的识别结果。按用户隔离后同用户同图仍零调用，成本防线不受影响，隐私边界更严。
- **落库时剥掉 `description` 和 `tags`**（`ai.controller.ts`）。这两个字段体积大、对成本和准确率量化没用，留着会把 `resultJson` 撑胖。
- **`aiResultId` 的回填只认"本人 + 未关联"**。改前只判 `itemId: null`，任何人拿别人的 id 就能把别人的识别记录挂到自己物品上，详情页直接读到（C14，已修）。

## 3. 搜索解析链路（双路 + 降级）

```
GET /search?q=...&type=all|item|space
  ├─ 短词判定：q.length ≤ 6 且不含「在哪/哪里/什么颜色/帮我找/怎么找」
  │     命中 ⇒ 直接拿 q 做关键词查库（source = "关键词直查数据库"，不调模型、不落 AIResult）
  └─ 否则 ⇒ chat(qwen-turbo, PARSE_PROMPT, max_tokens 200)
        成功 ⇒ { keyword, color, features }，source = "LLM Query Parser"，落 AIResult（含 usage）
        失败 ⇒ 降级用 q 做关键词查，source = "LLM 不可用，降级关键词直查"，
               **降级也必须落库**，且把根因写进 reason —— 否则降级率统不出来
```

- **同义词靠提示词**：`keyword` 允许模型给 `鼠标|滑鼠` 这种形式，服务端按 `|、,，` 和空白拆成数组做 OR 匹配。
- **`color` 两处口径**（C23，实测过）：查询侧要 `mode: 'insensitive'`（库里存 `"Black"`、用户搜 `black` 得命中）；解析侧非字符串一律归 `null`（模型返回 `{"color":{"主色":"黑"}}` 时原样透传会让 Prisma 抛错 ⇒ 搜索 500）。
- **`features` 只回显、不参与过滤**，v1.7 已写进契约，不再留口径空白。
- **`type=space` 不调模型**：空间名匹配在内存里做，省一次调用。

## 4. 成本防线（从上游到下游逐层拦）

| 层 | 做法 | 位置 |
|---|---|---|
| 1 | 前端压缩图片再传 | 小程序侧 |
| 2 | 4MB 硬限（413） | `ai.controller.ts` |
| 3 | `max_tokens` 500 / 200 | `ai.service.ts` |
| 4 | 短词直查，压根不调模型 | `search.service.ts` |
| 5 | `type=space` 不走 LLM | `search.service.ts` |
| 6 | 24h 结果缓存，命中零调用 | `ai.service.ts` |
| 7 | 限流 `/ai/*` 10 次/分钟（按凭证分桶，C19） | `ai.controller.ts` + `common/throttle-tracker.ts` |
| 8 | 每次调用的 usage 落库 ⇒ 成本可算账 | `AIResult` 表 |

实测数（口径都标清楚，别混着引用）：

- **单次识别 536 tokens**（2026-09-21 真实照片实测）。按 `qwen-vl-plus` 现价 8 元/百万输入、2 元/百万输出估算 **≈ ¥0.004/张**；具体输入/输出拆分当时没留档，所以只给估算不给到分。
- **缓存效果：2664ms → 7ms**（同一张图第二次识别）。
- 关键词直查**稳态中位 5ms**（热态连测 12 次，4~10ms）；`smoke.mjs` 报的 62~82ms 是**脚本首请求含客户端建连**的口径。
- 单价表有**两份拷贝**：`stats.service.ts` 的 `PRICE_PER_M` 和 `docs/验证脚本/usage.cjs`。**改价必须同步改两处**，否则同一笔调用两边算出来不一样。

## 5. 统计口径（`GET /api/v1/stats`）

| 规则 | 为什么 |
|---|---|
| 只统计调用者本人的记录 | C09：改前 `AIResult` 没有 `userId`，接口返回全平台聚合，任何登录用户能看到别人的 token 消耗 |
| **缓存命中不落 usage**（`usage: null`） | C03：改前命中时把首次那笔 usage 原样复制一份落库，同图重复保存就重复计成本 ⇒ 历史成本数字全部虚高 |
| 命中率分母只算 `recognize` | C07：缓存只存在于识图链路，把 parse-query 混进分母会系统性稀释，命中率永远偏低 |
| 支持 `?days=1..365` | C08：改前无任何过滤地把整张表读进内存逐行 `JSON.parse` |
| 如实报 `unattributed` | 迁移只回填能反查归属的行，其余留 null；本地那 25 条已于 09-23 删除归档，现为 0 |

⚠️ **C03 修复之前导出的所有 token 合计与成本数字一律作废**，不要写进 PRD 或简历。要重导：`node docs/验证脚本/usage.cjs --user=<id>`，与 `/stats` 同口径可对上（09-22 交叉验证过：同为 1 次 / 87 tokens / ¥0.000031）。

## 6. 失败与降级是怎么被看见的

- `chat()` 把上游错误映射成 `503 ServiceUnavailable`，**并把根因带在消息里**（`HTTP 401` / `ECONNREFUSED` / 超时码），这样降级落库的 `reason` 才有诊断价值。消息里不含 key。
- 输出解析失败 → `400` + 友好文案（用户能看懂、能改用手动填写），**不是 500**。
- **一次真实事故**：API key 被换掉后搜索降级率 100%，前端看着"还能用"。靠的就是降级记录落在 `AIResult` 里 —— 查这批记录的 `reason` 字段直接看到满屏 `HTTP 401`，才定位到是 key 失效而不是模型能力问题。**这就是"降级也要落库"的价值**。
- 缓存命中不落 usage 这件事，当时的单测还**把缺陷固化成了正确行为**（断言"命中应回传原 usage"）⇒ 测试绿灯不等于行为正确，改代码时要连带审测试在断言什么。

## 7. 红线

- `DASHSCOPE_API_KEY` **只存在于 `server/.env`**（已被 `.gitignore` 命中），`.env.example` 里只有 `sk-xxxxxxxxxxxxxxxx` 占位。
- key **绝不进小程序前端** —— 前端只调自己的后端，由后端代持 key 转发。
- CI 有 gitleaks 兜底（`--exit-code 1`，发现即失败，日志 `--redact` 打码）。
- AI 调用日志与 `AIResult` 里都不写 key、不写完整 base64 图片。

## 8. 已知限制

| 事实 | 状态 |
|---|---|
| 缓存是**进程内 `Map`**，重启即失效、多实例不共享 | 单实例部署下够用；上多实例要换 Redis |
| 缓存清理是"超过 200 条时扫一遍过期的"，不是定时任务 | 内存上限不可预测（200 条 × 结果体积） |
| 没有记录每次调用的耗时 ⇒ `/stats` 的 `avgDurationMs` 恒为 `null` | 用量页那张卡永远显示"—"，属契约已知项 |
| 识图准确率没有量化基线 | 待 F13：20 张真实照片跑可用率 |
| 提示词写死在代码里，改提示词要走发版 | 未做配置化 |
