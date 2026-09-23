# Findly 系统架构

> 维护人：@james-wu66 ｜ 依据 `main` = **`4154a49`** 的代码逐项核对（非回忆、非照抄设计稿）
> 配套：`database.md`（数据模型细节）、`ai.md`（AI 链路细节）、`api.md`（接口契约 **v1.7**）、《Findly_项目交接文档_2026-09-20.md》（进度与已知问题）
> 本文只描述"系统长什么样"。**进度与问题清单只在交接文档里记一份**，避免两处各写一遍然后对不上。

---

## 一、一图总览

```
┌── 微信小程序（原生 + TypeScript，19 页 / 47 个 .ts）──────────────┐
│  pages/*        视图与交互                                         │
│  services/*     唯一出口：request.ts 统一带 Bearer、401 自动重登重放│
│  custom-tab-bar / components/*   图片 URL 唯一收口：config.fullUrl()│
└──────────────────────────┬────────────────────────────────────────┘
                           │ HTTPS  JSON + multipart（图片）
                           │ 认证：Authorization: Bearer <JWT 7天>
┌──────────────────────────▼────────────────────────────────────────┐
│  NestJS 10 后端（server/，39 个 .ts / 约 2015 行 / 10 个模块）      │
│                                                                   │
│  全局横切：ThrottlerGuard（限流，按凭证分桶）→ JwtAuthGuard（鉴权） │
│            ValidationPipe（DTO 校验 + name 先 trim）               │
│            LoggingInterceptor（日志）· AllExceptionsFilter（错误）  │
│  Nest 之外一道：/uploads/* 静态资源的 JWT 守卫（common/uploads-auth）│
│  业务模块：ai · auth · items · search · spaces · stats · upload   │
│            · users · prisma · common                              │
└──────┬───────────────────────────────────────────┬────────────────┘
       │ Prisma 5 ORM（类型由 schema 生成）          │ HTTPS（OpenAI 兼容模式）
┌──────▼──────────────────────┐   ┌────────────────▼────────────────┐
│  PostgreSQL 16（6 表 / 3 迁移│   │ 阿里云百炼 DashScope             │
│  / 15 个索引）               │   │ qwen-vl-plus 识图               │
│  本地图片 server/uploads/    │   │ qwen-turbo   查询解析           │
└─────────────────────────────┘   └─────────────────────────────────┘
```

要点：**AI 结果永远只是草稿**。识图返回后必须由用户在前端确认/编辑，才通过 `POST /items` 入库 —— 这是产品铁律，也是"AI 不可用功能不中断"那条降级链的前提。

---

## 二、一次请求的生命周期（面试最常问的就是这张流程）

```
入站
 0. trust proxy（可选）      由 TRUST_PROXY_HOPS 显式设；默认不信任 X-Forwarded-For（它可被伪造）
 1. express json 中间件      限 6MB（识图走 base64，默认 100KB 会把大图拒成不可诊断的 500）
 2. ThrottlerGuard           全局 120 次/分钟；/ai/* 10、/upload 12、cleanup-orphans 6
                            分桶键 = 凭证摘要（无凭证才回落 IP）⇒ 反代后不会全站共享额度
 3. JwtAuthGuard（全局守卫）  @Public() 放行；否则验签 Bearer，
                            通过后【把 payload.sub 覆写进 x-user-id 头】⇒ 客户端伪造无效
 4. ValidationPipe           whitelist + transform：未声明字段直接丢弃、类型不匹配即 400；
                            name 类字段先 trim 再校验（纯空白等同空串）
业务
 5. Controller               只做取参、调 service；userIdFrom(req) 取身份
 6. Service                  Prisma 查询；标签替换走 $transaction；LLM 失败走降级
 7. Prisma → PostgreSQL
出站
 8. LoggingInterceptor       每请求一行「方法 路径 状态码 耗时ms」
                            ⚠️ 用 res 'finish' 事件而非 rxjs finalize——否则 400/404 会被记成 200
 9. AllExceptionsFilter      HttpException 原样透传；未知异常统一 500 友好文案，
                            堆栈只进服务端日志；体积超限分别映射成准确的 413
```

**三个刻意的设计**：
- 身份只有**一个来源**（守卫覆写后的 `x-user-id`），所以"数据按用户隔离"在代码里是一处收口，而不是每个查询各自判断。
- 拦截器/过滤器/守卫全部**全局注册**（`app.module.ts` + `main.ts`），新增控制器默认就在保护圈内。
- **限流跑在鉴权之前**，所以分桶键不能依赖"验签后的 userId"（那一刻还没有可信身份）。改按凭证摘要分桶：抗绕过能力等价（要绕得再注册一个账号），又保住了"未验签的垃圾请求也进限流表"这条兜底。

**图片请求走另一条路**：`/uploads/*` 由 express 静态中间件服务，**不经过第 2/8 步**（所以它不进全局日志、也不吃全局限流），为此在静态服务之前单独加了一道 `common/uploads-auth.ts`：校验 Bearer 或 `?token=`，并自己记一行访问日志（只记去掉 query 的路径，token 不落盘）。

---

## 三、模块清单

| 模块 | 职责 | 关键文件 | 对外 |
|---|---|---|---|
| `ai` | qwen-vl 识图、查询解析、**结果缓存**、降级 | `ai.service.ts`、`ai.controller.ts` | `POST /ai/recognize` |
| `search` | 一句话搜索：双路解析 + 三页签 + 位置路径 + 建议词 | `search.service.ts` | `GET /search`、`GET /search/suggestions` |
| `items` | 物品 CRUD、软删、分页筛选、分类 chips、同类推荐 | `items.service.ts`、`dto.ts` | 7 个端点 |
| `spaces` | 空间树（`parentId` 自关联）、**环检测 + 深度校验**、删除保护 | `spaces.service.ts` | `GET/POST/PATCH/DELETE /spaces` |
| `auth` | 微信 code→openid→JWT；全局守卫 | `auth.service.ts`、`jwt-auth.guard.ts`、`public.decorator.ts` | `POST /auth/login`（+ 联调 `dev-token`，上线前删） |
| `upload` | 图片上传（magic bytes 校验）、孤儿图片清理（**默认关闭 + 名单**） | `upload.controller.ts`、`upload.service.ts` | `POST /upload`、`POST /upload/cleanup-orphans` |
| `stats` | AI 用量与成本聚合（**按调用者归属**） | `stats.service.ts`、`stats.controller.ts` | `GET /stats` |
| `users` | 当前用户资料与计数 | `users.controller.ts` | `GET/PATCH /users/me` |
| `prisma` | 数据访问单例 + 幂等建户 | `prisma.service.ts` | 全局注入 |
| `common` | 位置路径拼装、用户 id 取值、异常过滤器、日志拦截器、**限流分桶键**、**name trim 装饰器**、**uploads 守卫** | `path.util.ts`、`user.util.ts`、`all-exceptions.filter.ts`、`logging.interceptor.ts`、`throttle-tracker.ts`、`trim-name.decorator.ts`、`uploads-auth.ts` | 内部复用 |

前端侧同样是纵切：`services/` 模块与后端一一对应，`types/api.ts` 用 interface 钉住契约形状，`services/config.ts` 的 `fullUrl()` 是图片 URL 的唯一出口（`?token=` 也只在这一处拼）。

---

## 四、数据模型（详版见 `database.md`）

```
User 1─＊ Item 1─＊ ItemTag ＊─1 Tag
User 1─＊ Space ─┐（parentId 自关联成树，深度上限 20）
Space 1─＊ Item ─┘   Item 1─＊ AIResult（识别记录，可回填 itemId）
```

- 六表、业务列共 43 个；`ItemTag` 是纯关联表（复合主键，无 id）
- **软删除**：`Item.deletedAt`，所有读路径统一带 `deletedAt: null`
- **归属**：`Item` / `Space` / `AIResult` 都有 `userId`，且**每条查询都必须带**（C09 修统计、C14 修回填，是同一类漏洞的两个出口）
- **防重复**：`Tag` 用 `@@unique([userId, name])`，写入走 `connectOrCreate`，且服务端先 trim + 去重（重复标签曾撞主键 → 500）
- 索引 15 条（6 主键 + 2 唯一 + 7 普通）；`AIResult.taskType` 刻意不建（基数太低，走索引反而慢）

---

## 五、AI 链路与成本控制（详版见 `ai.md`）

多层防线，从省钱到不崩：

| 层 | 做法 | 位置 |
|---|---|---|
| 1 | 上传前压缩 + 4MB 硬限（413） | 前端 `compressImage`；`ai.controller.ts` |
| 2 | 请求体上限 6MB，留出 JSON 包装余量 | `main.ts` |
| 3 | `max_tokens`：识图 500 / 解析 200 | `ai.service.ts` |
| 4 | **短词短路**：≤6 字且无疑问词 → 直接查库，零 token | `search.service.ts` |
| 5 | `type=space` 与建议词**完全不调 LLM** | `search.service.ts` |
| 6 | **识别结果缓存** 24h，key 掺 userId 做用户隔离 | `ai.service.ts` |
| 7 | LLM 失败自动降级关键词直查，且**降级也落库**（带根因） | `search.service.ts` |
| 8 | 限流：`/ai/*` 10 次/分钟，按凭证分桶 | `ai.controller.ts` + `common/throttle-tracker.ts` |
| 9 | `usage` 落库 ⇒ 单次成本可计算（实测 536 tokens/张 ≈ ¥0.004） | `ai.controller.ts` |

失败处理：`extractJson` 会剥 markdown 围栏再截 JSON，解析不出来给**用户可读的友好文案**而不是堆栈；上游错误统一映射成 503 并**把根因带进消息**，才能事后从 `AIResult.reason` 里看出是 key 失效还是模型问题。

---

## 六、安全边界

| 面 | 现状 |
|---|---|
| 密钥 | 只在后端 `.env`（gitignore + CI gitleaks 双兜底）；前端永不出现 AppSecret/API key |
| 鉴权 | 全局 JWT；`@Public()` 只留给 `auth/login` 与 `auth/dev-token`（后者双重开关，生产恒 403） |
| 越权 | 业务查询一律带 `userId`；**统计（C09）与识别记录回填（C14）两处跨用户出口都已堵**，并有常驻脚本 `cross-user-isolation.cjs` 做两用户互试 |
| 上传 | 扩展名白名单 + **magic bytes 内容校验**（防改名伪装）；服务端生成随机文件名防穿越/覆盖；单独限流 12/分钟 |
| 静态图片 | `/uploads/*` 需凭证（`Authorization` 或 `?token=`），并**有访问日志**（token 不落盘）；下游异常交回 Express 错误链，不再被伪装成 401 |
| 破坏性接口 | `cleanup-orphans` 默认 403，需 `CLEANUP_ORPHANS=1` 且在 `CLEANUP_ADMINS` 名单内；`dryRun` 缺省为 true；24h 保护窗口 |
| 文档暴露 | Swagger 生产不挂载（需 `SWAGGER=1` 临时开） |
| 待收 | CORS 收紧、helmet、`JWT_SECRET` 换强随机、删 `dev-token` ⇒ 见交接文档 B08 十项（已达成 5 项）+ 三个运维开关 |

---

## 七、部署形态

**当前**：本地 PostgreSQL + `node dist/src/main.js`（注意入口是 `dist/src/`，不是 `dist/main.js`）；图片落 `server/uploads/`。

**规划**：Docker Compose 编排 app + postgres + nginx；HTTPS 域名 + 微信合法域名；`uploads/` 换持久卷或对象存储（届时移除本地静态服务与 `?token=` 方案）；`prisma migrate deploy` 纳入部署步骤；环境变量按 `.env.example` 核对，其中三个是本轮新增：`TRUST_PROXY_HOPS=1`（不设等于限流的 IP 兜底桶与日志地址全是代理自己）、`CLEANUP_ORPHANS` / `CLEANUP_ADMINS`（默认关）。

---

## 八、已知限制（诚实列，全部可查编号）

1. `AIResult.userId` 列仍可空 —— 迁移只回填能经 `Item` 反查归属的行；本地那 25 条无从判定的已于 2026-09-23 删除（删前整表归档），所以现在 `/stats` 的 `unattributed` 是 0，但字段保留：新记录若识别后未保存成物品仍会是 null。
2. `stats` 聚合仍在 Node 侧逐行 `JSON.parse`（已按用户 + 时间范围过滤并建索引，但没下推到数据库）。数据量大了再做。
3. ~~限流按 IP~~ ⇒ 已改为按凭证分桶 + 匿名回落 IP（C19）；~~图片访问无日志~~ ⇒ 已补（C18）。**但图片那条日志与业务日志不同源**（一个在 express 中间件、一个在 Nest 拦截器），格式不统一。
4. **C25**：只含软删物品的空间可以被删除，而 `Item_spaceId_fkey` 是 `SET NULL` ⇒ 回收站里那些物品的位置会被静默清掉（实测：`deletedAt` 仍在、`spaceId` 变 null）。修它要先定产品口径"回收站恢复要不要保住位置"。
5. **CI 不连真库**（Prisma 全 mock）⇒ CI 绿 ≠ 能跑。09-21 那次 provider 被误提交成 sqlite 就是这么溜进 main 的。现在补了两道 schema 自检（`prisma validate` + provider 与迁移锁比对），**但 schema 与迁移的 drift 仍要影子库才能查**，那是下一步。
6. 识图准确率、图片压缩率**没有量化基线** —— 待 F13 用 20 张真实照片跑。
