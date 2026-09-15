/**
 * 当前用户（契约 v1.3 §5.3）：GET /users/me。
 * silent：个人中心 onShow 轮询场景，失败不弹 toast，由页面保持兜底展示。
 */
import request, { isApiError } from './request'
import type { UsersMe } from '../types/api'

export function getMe(): Promise<UsersMe | (UsersMe & { __error: true })> {
  return request<UsersMe>('/users/me', { silent: true })
}

export { isApiError }
