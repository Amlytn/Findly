/**
 * Findly API 响应类型 —— 与 docs/api.md v1.2 及后端实测返回逐字段对齐
 * 禁止自创字段；字段可空性以实测返回为准。
 */

/** 空间树节点（GET /spaces 的 tree；节点含 children 递归） */
export interface SpaceTree {
  id: string
  name: string
  itemCount: number
  parentId?: string | null
  sortOrder?: number
  children?: SpaceTree[]
}

/** 空间平铺项（GET /spaces 的 list，实测与树节点同构） */
export type SpaceListItem = SpaceTree

/** GET /spaces */
export interface SpaceListResponse {
  list: SpaceListItem[]
  tree: SpaceTree[]
}

/** 物品简要空间（后端嵌套 space 字段） */
export interface ItemSpaceRef {
  id: string
  name: string
}

/** GET /items 列表项 / GET /search results 项（契约 v1.2：tags 为字符串数组） */
export interface ItemListItem {
  id: string
  name: string
  brand: string | null
  model: string | null
  category: string
  color: string | null
  tags: string[]
  space?: ItemSpaceRef
  path: string
  imageUrl: string | null
  updatedAt?: string
}

/** GET /items 分页响应 */
export interface ItemListResponse {
  total: number
  page: number
  pageSize: number
  items: ItemListItem[]
}

/** AI 识别历史记录（详情 aiResults；结构按 items.service.ts detail 实测映射） */
export interface AiResultBrief {
  id: string
  taskType: string
  model: string
  result: RecognizeResult | unknown
  createdAt: string
}

/** GET /items/:id 详情 */
export interface ItemDetail {
  id: string
  name: string
  brand: string | null
  model: string | null
  category: string
  color: string | null
  description: string | null
  quantity: number
  status: string
  tags: string[]
  space: ItemSpaceRef | null
  imageUrl: string | null
  updatedAt: string
  aiResults: AiResultBrief[]
}

/** GET /items/categories 分类 chips */
export interface CategoryCount {
  name: string
  count: number
}
export interface CategoriesResponse {
  categories: CategoryCount[]
}

/** GET /items/:id/related */
export interface RelatedResponse {
  items: ItemListItem[]
}

/** POST /items 请求体 */
export interface CreateItemDto {
  name: string
  category: string
  brand?: string | null
  model?: string | null
  color?: string | null
  description?: string | null
  quantity?: number
  spaceId: string
  imageUrl?: string
  tags?: string[]
  aiResultId?: string
}

/** PATCH /items/:id 请求体（全部可选，整体替换 tags） */
export interface UpdateItemDto {
  name?: string
  category?: string
  brand?: string | null
  model?: string | null
  color?: string | null
  description?: string | null
  quantity?: number
  spaceId?: string
  imageUrl?: string
  tags?: string[]
}

/** 搜索解析结果（source 三取值见 api.md 135-138 行） */
export interface ParsedQuery {
  keyword: string
  color: string | null
  features: string[]
  source: string
}

/** 搜索结果中的空间项（type=all） */
export interface SearchSpaceItem {
  id: string
  name: string
  path: string
}

/** GET /search */
export interface SearchResponse {
  parsed: ParsedQuery
  results: ItemListItem[]
  spaces: SearchSpaceItem[]
}

/** GET /search/suggestions */
export interface SuggestionsResponse {
  suggestions: string[]
}

/** POST /ai/recognize 响应（qwen-vl 草稿；aiResultId 供保存物品时回填，契约 v1.2） */
export interface RecognizeResult {
  name: string
  category: string
  brand: string | null
  model: string | null
  color: string
  description: string
  tags: string[]
  confidence: number
  aiResultId?: string
}

/** 后端统一错误响应（api.md 12-16 行） */
export interface ApiError {
  statusCode: number
  message: string | string[]
  error: string
}
