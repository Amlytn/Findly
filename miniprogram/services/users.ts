/**
 * 当前用户（契约 v1.4 §5.3）：GET / PATCH /users/me。
 * getMe silent：个人中心 onShow 轮询场景，失败不弹 toast，由页面保持兜底展示。
 */
import request, { isApiError } from './request'
import type { UsersMe } from '../types/api'

export function getMe(): Promise<UsersMe | (UsersMe & { __error: true })> {
  return request<UsersMe>('/users/me', { silent: true })
}

/** PATCH 请求体：字段均可选，缺省不更新 */
export interface UpdateMeDto {
  nickname?: string
  avatar?: string
}

export function updateMe(data: UpdateMeDto): Promise<UsersMe> {
  return request<UsersMe>('/users/me', { method: 'PATCH', data })
}

export { isApiError }
