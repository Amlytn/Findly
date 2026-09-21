/** 物品接口（api.md 第 2 节） */
import request from './request'
import {
  ItemListResponse, ItemDetail, CategoriesResponse, RelatedResponse,
  CreateItemDto, UpdateItemDto
} from '../types/api'

export interface ItemListQuery {
  page?: number
  pageSize?: number
  spaceId?: string
  keyword?: string
  /** 分类精确筛选（契约 v1.4）：与 categories 接口计数口径一致 */
  category?: string
}

export function getItems(query: ItemListQuery = {}): Promise<ItemListResponse> {
  const parts: string[] = []
  if (query.page) parts.push('page=' + query.page)
  if (query.pageSize) parts.push('pageSize=' + query.pageSize)
  if (query.spaceId) parts.push('spaceId=' + encodeURIComponent(query.spaceId))
  if (query.keyword) parts.push('keyword=' + encodeURIComponent(query.keyword))
  if (query.category) parts.push('category=' + encodeURIComponent(query.category))
  const qs = parts.length ? '?' + parts.join('&') : ''
  return request<ItemListResponse>('/items' + qs)
}

/** silent=true 时错误 resolve 出 {__error}（收藏页按 id 批量拉取用，避免失效 id 逐个弹 toast） */
export function getItem(id: string, silent = false): Promise<ItemDetail> {
  return request<ItemDetail>('/items/' + id, { silent })
}

export function createItem(data: CreateItemDto): Promise<ItemDetail> {
  return request<ItemDetail>('/items', { method: 'POST', data })
}

export function updateItem(id: string, data: UpdateItemDto): Promise<ItemDetail> {
  return request<ItemDetail>('/items/' + id, { method: 'PATCH', data })
}

/** 软删除；契约：重复删除返回 404，前端视为成功，故 silent 交由调用方判断 */
export function deleteItem(id: string): Promise<unknown> {
  return request('/items/' + id, { method: 'DELETE', silent: true })
}

export function getCategories(): Promise<CategoriesResponse> {
  return request<CategoriesResponse>('/items/categories')
}

export function getRelated(id: string): Promise<RelatedResponse> {
  return request<RelatedResponse>('/items/' + id + '/related')
}
