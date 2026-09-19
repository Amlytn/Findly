# Findly API 接口契约（v1.4）

> 前后端共同遵守的接口约定。改接口必须先改本文档，再动代码（PR 同步提交）。
> 维护人：@james-wu66 ｜ 协作：@Amlytn
> 评审状态：v1.4（M5 鉴权收紧：401 拦截生效、x-user-id 兜底移除；items 增加 category 精确筛选与 quantity 返回；items/spaces 支持 null 解绑语义；users 新增 PATCH /me；上传增加 magic bytes 校验。v1.3：M4 三接口由提案转正式：auth/login、upload、users/me；认证支持 Bearer token；新增 429 限流。v1.2：tags 统一字符串数组、aiResultId 回填、DELETE 幂等语义）

## 通用约定

- Base URL：`http://localhost:3000`（联调期；上线后换 HTTPS 域名）
- 认证：请求头 `Authorization: Bearer <token>`（token 来自 `POST /auth/login`，7 天有效）。**除 auth/login、auth/dev-token 外所有接口均要求有效 token**：无 token 或 token 失效返回 401，前端据此静默重登并重放原请求（M5 起 `x-user-id` 兜底已移除，该头由服务端验签后覆写，不接受客户端伪造）
- 时间格式：ISO 8601（如 `2026-09-14T09:00:00.000Z`）
- 错误响应统一为 NestJS 默认格式：

```json
{ "statusCode": 400, "message": "具体原因", "error": "Bad Request" }
```

- 常用状态码：200 成功 / 400 参数错误 / 401 未登录或登录过期 / 404 不存在 / 403 无权访问 / 413 文件过大 / 429 触发限流 / 503 AI 服务不可用
- 限流：全局 120 次/分钟；`/ai/*` 10 次/分钟（超出返回 429）

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
{ "name": "书房", "parentId": "sp1", "sortOrder": 0 }
```

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
- 成功后前端所有请求改带 `Authorization: Bearer <token>`，替换 `x-user-id`（过渡期 x-user-id 仍被接受，M5 移除）
- 错误：400（code 无效 / 服务端未配置 WX_APPID/WX_APPSECRET）

### 5.2 图片上传 `POST /api/v1/upload`

- multipart/form-data，字段名 `file`；仅 png/jpeg/webp；≤4MB（413）
- 存 `server/uploads/`（已 ignore），随机文件名；返回 `{ "imageUrl": "/uploads/xxx.jpg" }`，可通过 `GET /uploads/文件名` 直接访问
- 后续迁移对象存储时仅改实现，路径形态不变
- 错误：400（格式不对）/ 413（超 4MB）

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
