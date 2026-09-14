# Findly API 接口契约（v1.1）

> 前后端共同遵守的接口约定。改接口必须先改本文档，再动代码（PR 同步提交）。
> 评审状态：v1.1（jameswu 起草；v1.1 按协作规范第 9 节「12 屏实现范围」补 4 个接口，标"提案"的返回格式待同学确认）

## 通用约定

- Base URL：`http://localhost:3000`（联调期；上线后换 HTTPS 域名）
- 认证：请求头 `x-user-id: <用户id>`（演示阶段，缺省 `dev`；M4 接入微信登录后替换为 token）
- 时间格式：ISO 8601（如 `2026-09-14T09:00:00.000Z`）
- 错误响应统一为 NestJS 默认格式：

```json
{ "statusCode": 400, "message": "具体原因", "error": "Bad Request" }
```

- 常用状态码：200 成功 / 400 参数错误 / 404 不存在 / 403 无权访问 / 413 文件过大 / 503 AI 服务不可用

---

## 1. 空间 `/api/v1/spaces`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/spaces` | 空间平铺 list + 组装好的 tree（含每层物品数） |
| POST | `/api/v1/spaces` | 新建空间 |
| PATCH | `/api/v1/spaces/:id` | 改名 / 挪父级 / 排序 |
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

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/items?page=1&pageSize=20&spaceId=&keyword=` | 分页列表；keyword 模糊匹配 name/brand/model/category/description |
| POST | `/api/v1/items` | 新增（拍照确认后保存走这里） |
| GET | `/api/v1/items/:id` | 详情（含 space、tags、最近 5 次 AI 识别记录） |
| PATCH | `/api/v1/items/:id` | 编辑 / 移动位置（改 spaceId）/ 整体替换 tags |
| DELETE | `/api/v1/items/:id` | 软删除（deletedAt 置时间，列表不再出现） |
| GET | `/api/v1/items/categories` | 分类筛选 chips（v1.1 新增，规范第 9 节）——**同学模块** |
| GET | `/api/v1/items/:id/related` | 同类物品（v1.1 新增，规范第 9 节）——**同学模块** |

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
  "tags": ["鼠标", "无线", "办公"]
}
```

GET 列表返回：

```json
{
  "total": 3, "page": 1, "pageSize": 20,
  "items": [ { "id": "it1", "name": "白色无线鼠标", "space": { "id": "sp4", "name": "右侧抽屉" }, "tags": [ { "tag": { "name": "鼠标" } } ] } ]
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

生成规则（提案，待同学确认设计意图）：从当前用户物品的名称/标签/分类中提炼高频词，按出现次数倒序，最多 10 个；没有任何物品时返回空数组（前端隐藏该区域）。

```json
{ "suggestions": ["鼠标", "充电器", "HDMI"] }
```

## 4. AI 识别 `/api/v1/ai/recognize`

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

## 5. 尚未提供（前端先不要调）

- 微信登录（M4）：`POST /api/v1/auth/login`（预留）
- 图片上传到对象存储（M4）：当前 imageUrl 传空字符串即可
- 以上接口在本文档补充后，前端才接入
