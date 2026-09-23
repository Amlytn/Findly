# Findly API 接口契约（v1.7）

> 前后端共同遵守的接口约定。改接口必须先改本文档，再动代码（PR 同步提交）。
> 维护人：@james-wu66 ｜ 协作：@Amlytn
> 评审状态：**v1.7（批次①+批次② 的对外可见变化一次记齐，并订正两处与实现矛盾的旧话）**。①`aiResultId` 只回填本人记录（C14 越权）；②`name` 先 trim 再校验、空串与纯空白一律 400（C16，items/spaces 四处同规则）；③`tags` 由服务端去重（C15，改前重复标签 → 500）；④`cleanup-orphans` 默认 403，需 `CLEANUP_ORPHANS=1` + `CLEANUP_ADMINS` 名单（C17）；⑤限流分桶键由 IP 改为"凭证优先、匿名回落 IP"，并给 `POST /upload` 12/分钟、`cleanup-orphans` 6/分钟（C19）；⑥空间树最多 20 层，超深 400（C21，改前 20~50 层路径静默截断、50 层以上成环漏判）；⑦`path` 在列表/POST/PATCH/详情四处统一返回，未归位为 `"未归位"`（C20，实现追上原契约）；⑧搜索的 `color` 补大小写不敏感、非字符串归 null，并明确 `features` 只回显不过滤（C23）；⑨图片访问落一行日志且 token 不落盘（C18）。**订正**：5.1 原写"过渡期 x-user-id 仍被接受"（M5 已移除）、5.2 原写"可通过 GET /uploads/文件名 直接访问"（C02 后需凭证）——两处均已按实况改写（C24）。**新增环境变量**：`TRUST_PROXY_HOPS` / `CLEANUP_ORPHANS` / `CLEANUP_ADMINS`，见 `.env.example`。v1.6（补写第 6 节 `GET /api/v1/stats` —— 该接口自 B02 上线起从未进契约，属流程遗漏；同时记入三项口径修正：C09 只统计调用者本人、C07 命中率分母改为 recognize、C08 新增可选 `days` 参数，并新增 `cacheHitDenominator` / `unattributed` / `rangeDays` 三个披露字段。数据库侧配套迁移：`AIResult` 增 `userId` 及 3 个索引、`ItemTag` 增 `tagId` 索引）**。v1.5（① **@Amlytn 的 PR #42 已给 spaces 增加 `type`/`icon` 契约，但合入时未升版本号，本次一并记账补记**，正文见第 1 节；② 补记 B03 的 `POST /upload/cleanup-orphans` 端点——该端点进 main 时未同步本契约，同属流程遗漏；并按 **C10** 修正其语义：孤儿判定增加 24h `mtime` 保护窗口、响应新增 `skippedRecent` / `graceHours`，见第 5.4 节）。v1.4（M5 鉴权收紧：401 拦截生效、x-user-id 兜底移除；items 增加 category 精确筛选与 quantity 返回；items/spaces 支持 null 解绑语义；users 新增 PATCH /me；上传增加 magic bytes 校验。v1.3：M4 三接口由提案转正式：auth/login、upload、users/me；认证支持 Bearer token；新增 429 限流。v1.2：tags 统一字符串数组、aiResultId 回填、DELETE 幂等语义）

## 通用约定

- Base URL：`http://localhost:3000`（联调期；上线后换 HTTPS 域名）
- 认证：请求头 `Authorization: Bearer <token>`（token 来自 `POST /auth/login`，7 天有效）。**除 auth/login、auth/dev-token 外所有接口均要求有效 token**：无 token 或 token 失效返回 401，前端据此静默重登并重放原请求（M5 起 `x-user-id` 兜底已移除，该头由服务端验签后覆写，不接受客户端伪造）
- 时间格式：ISO 8601（如 `2026-09-14T09:00:00.000Z`）
- 错误响应统一为 NestJS 默认格式：

```json
{ "statusCode": 400, "message": "具体原因", "error": "Bad Request" }
```

- 常用状态码：200 成功 / 400 参数错误 / 401 未登录或登录过期 / 404 不存在 / 403 无权访问 / 413 文件过大 / 429 触发限流 / 503 AI 服务不可用
- 限流（v1.7 / C19 改口径）：全局 **120 次/分钟**、`/ai/*` **10 次/分钟**、`POST /upload` **12 次/分钟**、`POST /upload/cleanup-orphans` **6 次/分钟**，超出返回 429。
  **分桶键不再是来源 IP**：带 `Authorization` 的请求按该凭证的短摘要分桶（= 一个账号一个桶），匿名请求回落到 IP。
  改前默认按 `req.ip`，而线上必经 nginx ⇒ 全站共用一个桶，一个人刷满、其他人跟着被限（实测：匿名打满后正常带凭证用户也 429）。
  配套：反代后需设 `TRUST_PROXY_HOPS=1`，否则 IP 兜底桶与日志里的来源地址都是代理自己的地址（不设 = 不信任 `X-Forwarded-For`，防伪造）。

---

## 1. 空间 `/api/v1/spaces`

> 归属：@Amlytn（物品/空间模块，契约已定待实现）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/spaces` | 空间平铺 list + 组装好的 tree（含每层物品数） |
| POST | `/api/v1/spaces` | 新建空间 |
| PATCH | `/api/v1/spaces/:id` | 改名 / 挪父级 / 排序；**`parentId` 传 `null` 或空串 = 移回根级**（v1.4） |
| DELETE | `/api/v1/spaces/:id` | 删除（有子空间或有物品时拒绝，返回 400） |

GET 返回示例：

```json
{
  "list": [ { "id": "sp1", "parentId": null, "name": "我的家", "itemCount": 3 } ],
  "tree": [ { "id": "sp1", "name": "我的家", "itemCount": 3, "children": [ { "id": "sp2", "name": "书房", "children": [] } ] } ]
}
```

POST 请求体：

```json
{ "name": "书房", "parentId": "sp1", "sortOrder": 0, "type": "room", "icon": "study" }
```

- `type`（可选）：`home / room / furniture / container` 四选一，由前端图标选择器按类映射填写；
- `icon`（可选）：语义图标 key（如 `kitchen`/`garage`/`basement`），为 null 或缺失时前端按名称匹配兜底展示；
- PATCH 中 `type`/`icon` 传 `null` 表示清除（回退兜底），`undefined` 表示不动。
- **`name` 一律先 trim 再校验，空串与纯空白都返回 400**（v1.7 / C16；创建与更新同规则，物品侧同）。
- **空间树最多 20 层**（v1.7 / C21）：`POST` 与 `PATCH` 在父级已处于第 20 层时返回
  `400 空间层级最多 20 层，当前父级已在第 20 层`；把某空间挪到自己的子孙之下仍返回 `400 不能移动到自己的子空间下（会形成环）`。
  此前"环检测回溯 50 层、拼路径只回溯 20 层"两个数不一致，20 层以上的路径会被静默截断（没有省略号提示）——现在写入侧就拦住，前端**不需要**再处理截断。
- 状态码差异（有意保留，前端可依赖）：`POST` 时 `parentId` 指向不存在的空间 → **404**；`PATCH` 时 → **400**。

## 2. 物品 `/api/v1/items`

> 归属：@Amlytn（物品模块，契约已定待实现）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/items?page=1&pageSize=20&spaceId=&keyword=&category=` | 分页列表；keyword 模糊匹配 name/brand/model/category/description；**`category` 精确等值筛选（v1.4，分类 chips 用，与 categories 接口计数口径一致）** |
| POST | `/api/v1/items` | 新增（拍照确认后保存走这里） |
| GET | `/api/v1/items/:id` | 详情（含 space、tags、最近 5 次 AI 识别记录） |
| PATCH | `/api/v1/items/:id` | 编辑 / 移动位置（改 spaceId）/ 整体替换 tags；**`spaceId` 传 `null` 或空串 = 解绑位置（移回"未归位"）**（v1.4） |
| DELETE | `/api/v1/items/:id` | 软删除（deletedAt 置时间，列表不再出现）；重复删除返回 404，前端视为已成功 |
| GET | `/api/v1/items/categories` | 分类筛选 chips（v1.1 新增，规范第 9 节）——**@Amlytn 实现** |
| GET | `/api/v1/items/:id/related` | 同类物品（v1.1 新增，规范第 9 节）——**@Amlytn 实现** |

POST / PATCH 请求体：

```json
{
  "name": "白色无线鼠标",
  "category": "电脑配件",
  "brand": "Logitech",
  "model": "MX Master 3S",
  "color": "白色",
  "quantity": 1,
  "spaceId": "sp4",
  "imageUrl": "",
  "tags": ["鼠标", "无线", "办公"],
  "aiResultId": ""
}
```

- `aiResultId` 仅 POST 时有效（v1.2 新增）：识别结果页保存时带回 recognize 流程生成的 AIResult id，后端回填 `AIResult.itemId`，供详情页「最近 5 次 AI 识别记录」查询；传空/无效值不影响保存。
  **v1.7 / C14：只回填「属于当前用户且尚未关联物品」的记录**。拿别人的 `aiResultId` 不会报错（保存仍 201），但那次回填是空操作——别人的识别记录不会挂到你身上，详情页也看不到。
  同一条 `aiResultId` 第二次保存（比如一次识别连存两件物品）时，第二件也不会覆盖第一件的关联。
- `tags` **由服务端去重**（v1.7 / C15）：先 trim、丢弃空串、再按首次出现顺序去重。`["鼠标","鼠标"," 鼠标 ","键盘"]` 落库为 `["鼠标","键盘"]`。
  改前重复标签会让同一 `(itemId,tagId)` 主键被插两次 → **500**；识别结果的标签来自 LLM，重复很常见，前端不必再去重。
- `name` **先 trim 再校验，空串与纯空白一律 400**（v1.7 / C16，POST 与 PATCH 同规则）。
  改前 `PATCH {"name":""}` 会返回 200 并把名字清空 ⇒ 该物品再也搜不到（name 是关键词匹配的五个字段之一）。
- **`path` 在四处返回体里都有**（v1.7 / C20）：列表、POST、PATCH、详情。此前只有列表带 path，
  而本节契约写的是"卡片统一含 path"——现在实现追上契约；未归位物品 `path` 为 `"未归位"`（不是缺字段、不是 null）。

GET 列表返回（v1.2：tags 统一为字符串数组；v1.4：增加 quantity）：

```json
{
  "total": 3, "page": 1, "pageSize": 20,
  "items": [ { "id": "it1", "name": "白色无线鼠标", "brand": "Logitech", "model": "MX Master 3S",
    "category": "电脑配件", "color": "白色", "quantity": 1, "tags": ["鼠标", "无线", "办公"],
    "space": { "id": "sp4", "name": "右侧抽屉" }, "path": "我的家 → 书房 → 书桌 → 右侧抽屉",
    "imageUrl": null, "updatedAt": "..." } ]
}
```

### 2.1 分类筛选 `GET /api/v1/items/categories`（提案，规范第 9 节定接口）

物品列表顶部分类 chips 数据：当前用户物品按 category 分组计数（软删除的排除）。

```json
{ "categories": [ { "name": "电脑配件", "count": 2 }, { "name": "线材", "count": 1 } ] }
```

### 2.2 同类物品 `GET /api/v1/items/:id/related`（提案，规则为规范第 9 节原文）

详情页「同类物品」：同分类**或**标签有交集；最多 5 件；**排除自身**。

```json
{ "items": [ { "id": "it2", "name": "显示器 HDMI 线", "brand": "绿联", "model": "", "category": "线材", "tags": ["线材", "HDMI"], "path": "我的家 → 书房 → 书柜二层", "imageUrl": null } ] }
```

## 3. 搜索 `/api/v1/search`

> 归属：@james-wu66（搜索模块）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/search?q=我的白色无线鼠标在哪里&type=all` | 简单词直查数据库；复杂句走 LLM 解析后查询；LLM 不可用自动降级 |

`type` 参数（v1.1 新增，搜索结果页「全部 / 物品 / 空间」三页签，规范第 9 节）：
- `all`（默认）：物品 + 空间都搜，返回里同时有 `results`（物品）和 `spaces`（空间）
- `item`：只搜物品，返回里只有 `results`
- `space`：只搜空间（按空间名称匹配），返回里只有 `spaces`

返回示例：

```json
{
  "parsed": { "keyword": "鼠标", "color": "白色", "features": ["无线"], "source": "LLM Query Parser" },
  "results": [
    { "id": "it1", "name": "白色无线鼠标", "brand": "Logitech", "model": "MX Master 3S",
      "category": "电脑配件", "color": "白色", "tags": ["鼠标", "无线", "办公"],
      "path": "我的家 → 书房 → 书桌 → 右侧抽屉", "imageUrl": null, "updatedAt": "..." }
  ]
}
```

`parsed.source` 三种取值（前端可展示"怎么找到的"）：
- `关键词直查数据库`（短词，如 `鼠标`）
- `LLM Query Parser`（自然语言长句）
- `LLM 不可用，降级关键词直查`（AI 挂了也能搜）

`parsed.color` 的口径（v1.7 / C23）：
- **大小写不敏感**：库里存 `"Black"`、用户搜"black"要能命中。此前关键词五个字段都带 `mode: 'insensitive'`，唯独 color 漏了（实测：不加 insensitive 命中 0 条，加了命中 1 条）。
- **非字符串一律归 null**：模型偶发返回 `"color": {"主色":"黑"}` 或数字，原样透传给 Prisma 的 `contains` 会直接抛错 ⇒ 搜索接口 500。现在在解析源头就归一为"trim 后的非空字符串或 null"，归 null 即不按颜色过滤。
- `parsed.features` **只回显、不参与查询过滤**（v1.7 明确写进契约；此前实现从未用它过滤，契约也没说，属口径空白）。

`type=all` 时返回里多一个 `spaces` 字段（提案）：

```json
{ "spaces": [ { "id": "sp2", "name": "书房", "path": "我的家 → 书房" } ] }
```

### 3.1 「你可能还想找」`GET /api/v1/search/suggestions`（v1.1 新增，规范第 9 节）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/search/suggestions` | 搜索建议词；**本地数据生成，不调 LLM** |

生成规则（v1.2 与实现对齐）：从当前用户物品的**标签与分类**中提炼高频词，按出现次数倒序，最多 10 个；**名称不做分词**（2026-09-14 拍板）；没有任何物品时返回空数组（前端隐藏该区域）。

```json
{ "suggestions": ["鼠标", "充电器", "HDMI"] }
```

## 4. AI 识别 `/api/v1/ai/recognize`

> 归属：@james-wu66（AI 模块）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ai/recognize` | 拍照 → 压缩 → base64 上传 → 返回结构化物品信息 |

请求体：

```json
{ "imageBase64": "data:image/jpeg;base64,/9j/4AAQ..." }
```

- 限制：仅 png/jpeg/webp；压缩后 ≤ 4MB（超限返回 413）
- 返回（qwen-vl 结构化输出，confidence 0~1）：

```json
{
  "name": "罗技白色无线鼠标", "category": "电脑配件", "brand": "Logitech",
  "model": "MX Anywhere 3", "color": "白色", "description": "无线办公鼠标",
  "tags": ["鼠标", "无线", "办公"], "confidence": 0.92
}
```

- 约定：AI 结果只是"草稿"，用户可修改后走 POST /items 保存——**前端必须允许编辑再保存**（方案文档第五节）
- 错误：400 格式不对 / 无法识别（提示"暂时无法准确识别这个物品，你可以手动填写名称"）；413 超限；503 AI 服务不可用

## 5. 认证 / 上传 / 用户（v1.3 转正式）

> 归属：M4 共同，已实现。联调通道 `/auth/dev-token` 为开发设施，不入对外契约（M5 移除）。

### 5.1 微信登录 `POST /api/v1/auth/login`

```json
// 请求
{ "code": "wx.login 返回的临时 code" }
// 200 返回
{ "token": "JWT", "user": { "id": "u1", "nickname": null, "avatar": null } }
```

- 后端持 AppID/AppSecret（.env，不入库）调 jscode2session 换 openid → openid 唯一 upsert User → 签发 JWT（7 天）
- 成功后前端所有请求改带 `Authorization: Bearer <token>`。**`x-user-id` 兜底已在 M5 移除**（v1.7 / C24 订正本行旧话）：
  该头现在只由服务端验签后覆写为 `payload.sub`，**客户端自己发一律不认**，无 token 或 token 失效都是 401。
- 错误：400（code 无效 / 服务端未配置 WX_APPID/WX_APPSECRET）

### 5.2 图片上传 `POST /api/v1/upload`

- multipart/form-data，字段名 `file`；仅 png/jpeg/webp（**服务端校验文件头 magic bytes，改扩展名无效**）；≤4MB（413）；限流 12 次/分钟（v1.7 / C19）
- 存 `server/uploads/`（已 ignore），随机文件名；返回 `{ "imageUrl": "/uploads/xxx.jpg" }`
- **`GET /uploads/文件名` 需要登录凭证**（v1.7 / C24 订正本行旧话——原文写的是"可直接访问"，与 C02 之后的实现矛盾了两周）：
  `Authorization: Bearer <token>` 或查询串 `?token=<token>` 二选一，都无效则 401。
  小程序 `<image src>` 发不出请求头，所以走 `?token=`；前端唯一收口是 `services/config.ts` 的 `fullUrl()`（@Amlytn 已接，PR #46）。
  访问会落一行日志（v1.7 / C18），**日志只记去掉 query 的路径，token 原文不会落盘**。长期方案仍是对象存储签名 URL。
- 后续迁移对象存储时仅改实现，`/uploads/xxx.jpg` 这个路径形态不变（前端不用改）
- 错误：400（格式不对）/ 401（取图无凭证）/ 413（超 4MB）/ 429（触发限流）

### 5.3 当前用户 `GET /api/v1/users/me` + 资料更新 `PATCH /api/v1/users/me`（v1.4 新增）

```json
// GET 200
{ "id": "u1", "nickname": null, "avatar": null, "itemCount": 12, "spaceCount": 5 }
```

```json
// PATCH 请求体：字段均可选，缺省不更新；传 null 显式置空
{ "nickname": "小明同学", "avatar": "" }
// PATCH 200 返回
{ "id": "u1", "nickname": "小明同学", "avatar": null }
```

### 5.4 孤儿图片清理 `POST /api/v1/upload/cleanup-orphans`（B03 已实现，v1.5 补记入契约 + C10 修正语义）

- 用途：删除 `server/uploads/` 下**未被任何物品引用、且已过保护窗口**的图片
- 需 Bearer token（走全局 `JwtAuthGuard`，无 `@Public`）；面向运维/自查，非小程序常规调用
- **权限门（v1.7 / C17）：默认关闭，调用即 403**。开启要同时满足两条：
  1. 环境变量 `CLEANUP_ORPHANS=1`；
  2. 调用者在 `CLEANUP_ADMINS` 名单内（逗号分隔）——**未配名单时只有 `NODE_ENV=development` 放行**，生产环境不配名单一律不放行。
  动因：本接口的"是否还被引用"是**跨用户全表**判断的，改前任一登录用户都能 `dryRun:false` 删掉全站图片，也能靠反复调用拖库。
  响应 `403 { message: "清理接口默认关闭（需设 CLEANUP_ORPHANS=1）" }` 等三种文案，见 `upload.controller.ts` 的 `assertCleanupAllowed`。
- 限流 **6 次/分钟**（v1.7 / C19，每次调用都要全表 findMany + 扫目录）
- 请求体：`{ "dryRun": false }` —— **缺省即 `true`（只报告不删）**，必须显式传 `false` 才真正删除
- 判定"孤儿"须**同时**满足两条：
  1. 文件名不出现在任何 Item 的 `imageUrl` / `thumbnailUrl`（**含软删除物品**，保守策略：回收站物品的图不删）
  2. **文件 `mtime` 早于 24 小时前**（C10 修正）——拍照 → 上传 → 保存物品之间存在"已上传但尚未被引用"的窗口，缺此阈值会删掉用户**正在编辑中**的物品图片
- 响应：

```json
{
  "scanned": 42,               // uploads/ 下图片文件总数
  "referenced": 30,            // 被物品引用的图片文件名数（去重后）
  "orphans": ["1758...a1b2.png"], // 本轮判定为孤儿（同时满足上面两条）的文件名，升序
  "skippedRecent": 3,          // 因未过 24h 保护窗口而本轮不删的数量
  "graceHours": 24,            // 保护窗口时长，见判定条件 2
  "deleted": 0,                // 实际删除数；dryRun=true 时恒为 0
  "dryRun": true
}
```

- 错误：401（无 token / token 失效）
- ⚠️ 运维红线：首次上线先 `dryRun: true` 核对 `orphans` 清单，确认无误再 `dryRun: false`

## 6. 用量统计 `/api/v1/stats`（B02 实现；v1.6 首次写入本契约；C09/C07/C08 修正口径）

> 该接口上线时字段定义只写在 `docs/Findly_T7用量统计_前端需求_2026-09-16.md`，**从未进本契约** —— 属流程遗漏，现补。字段名沿用 T7，前端 `pages/usage` 按此渲染，不得单方改动。

- 方法：`GET /api/v1/stats`，需 Bearer token
- **口径：只统计当前登录用户自己的 AI 调用**（C09）。此前 `AIResult` 无 `userId`，接口返回的是**全平台**聚合，任何登录用户可看他人用量与成本。
- 可选查询参数：`days`（整数 1~365）＝ 只统计最近 N 天（C08）；**缺省为全部**，前端既有不带参数的调用行为兼容。

```json
{
  "totalCalls": 23,                 // 本人记录条数（不含无归属历史）
  "totalTokens": 2132,              // usage.total_tokens 累加；命中缓存的行 usage 为 null，不重复计（C03）
  "estimatedCost": 0.011487,        // 按模型单价估算，单位 CNY
  "currency": "CNY",
  "degradedRate": 0.087,            // source 含「降级」的占比
  "cacheHitRate": 0.5,              // ⚠️ C07：分母是 cacheHitDenominator，不是 totalCalls
  "avgDurationMs": null,            // 无耗时数据源，固定 null
  "byTaskType": [                   // 按 recognize / parse-query 分组
    { "taskType": "recognize", "calls": 4, "tokens": 1072, "cost": 0.009 }
  ],
  "cacheHitDenominator": 2,         // v1.6 新增：命中率的分母，便于自查
  "unattributed": 0,                // v1.6 新增：无法判定归属的历史记录（本地库那 25 条已于 09-23 删除并归档）条数（披露用，不计入任何指标）
  "rangeDays": null,                // v1.6 新增：本次生效的时间范围，null＝全部
  "generatedAt": "2026-09-22T06:40:00.000Z"
}
```

**口径细则（都是踩出来的，改动前先读）**：

1. `cacheHitRate` 只按 **recognize** 计算 —— 缓存只存在于识图链路，把永不命中的 `parse-query` 放进分母会系统性压低命中率（C07）。
2. `estimatedCost` 的单价表与服务端 `stats.service.ts` 的 `PRICE_PER_M`、脚本 `docs/验证脚本/usage.cjs` 三方共用一套，**必须同步修改**，否则接口与命令行数字会对不上。
3. `unattributed`：C09 迁移只回填了能经 `Item` 反查出归属的历史行；识别后未保存成物品的记录无从判定，保持 `userId = null` 并**排除在统计之外**，只在这里报数 —— 避免"升级后数字突然变小"无法解释。
4. **C03 之前导出的历史 token/成本数字偏高**（缓存命中被重复计费），不要用作量化依据。
- 错误：401（无 token）/ 400（`days` 非 1~365 的整数）
