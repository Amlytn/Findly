/**
 * wx.request 统一封装：base URL、认证头、超时、错误规整。
 * 页面不得直接调 wx.request，一律经 services 业务函数。
 *
 * 认证（契约 v1.3）：优先 Authorization: Bearer <JWT>；
 * 无 token 时保留 x-user-id: dev 兜底（后端过渡期兼容，M5 移除）。
 */
import { ApiError } from '../types/api'
import { getToken } from './token'

// 联调期本地后端；上线后换 HTTPS 正式域名（并配小程序后台合法域名）
export const SERVER_ROOT = 'http://localhost:3000'
export const API_BASE = SERVER_ROOT + '/api/v1'

/** 上传/图片类接口返回的是相对路径（/uploads/...），<image> 需要完整 URL */
export function fullUrl(path: string | null | undefined): string {
  if (!path) return ''
  return /^https?:\/\//.test(path) ? path : SERVER_ROOT + path
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  data?: object
  /** 静默失败：resolve 出 { __error }，由页面自行处理（如 503 兜底） */
  silent?: boolean
}

function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', data, silent = false } = options
  return new Promise<T>(function (resolve, reject) {
    const token = getToken()
    const header: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) {
      header.Authorization = 'Bearer ' + token
    } else {
      // 过渡期兜底（契约 v1.3）：无 token 时后端仍接受 x-user-id，缺省 dev
      header['x-user-id'] = 'dev'
    }
    wx.request({
      url: API_BASE + path,
      method,
      data: data as any,
      timeout: 15000,
      header,
      success(res) {
        const code = res.statusCode
        if (code >= 200 && code < 300) {
          resolve(res.data as T)
          return
        }
        const body = res.data as Partial<ApiError> | undefined
        let message = '请求失败（' + code + '）'
        if (body && body.message) {
          message = Array.isArray(body.message) ? body.message.join('；') : String(body.message)
        }
        if (code === 429) message = '操作太频繁，请稍后再试'
        const err = { statusCode: code, message } as { statusCode: number; message: string }
        if (silent) {
          resolve(err as unknown as T & { __error: true })
        } else {
          wx.showToast({ title: message.slice(0, 30), icon: 'none' })
          reject(err)
        }
      },
      fail() {
        const err = { statusCode: 0, message: '网络不可用，请检查后端是否已启动' }
        if (silent) {
          resolve(err as unknown as T & { __error: true })
        } else {
          wx.showToast({ title: err.message, icon: 'none' })
          reject(err)
        }
      }
    })
  })
}

/** silent 模式下判断结果是否为错误 */
export function isApiError(res: unknown): res is { statusCode: number; message: string } {
  const r = res as { statusCode?: number } | null
  return !!r && typeof r.statusCode === 'number' && (r.statusCode < 200 || r.statusCode >= 300)
}

export default request
