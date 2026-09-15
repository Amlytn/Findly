/**
 * wx.request 统一封装：base URL、认证头、超时、错误规整。
 * 页面不得直接调 wx.request，一律经 services 业务函数。
 */
import { ApiError } from '../types/api'

// 联调期本地后端；上线后换 HTTPS 正式域名（并配小程序后台合法域名）
export const API_BASE = 'http://localhost:3000/api/v1'

// 演示阶段用户标识（契约 api.md 通用约定：x-user-id，缺省 dev；M4 换 token）
export const USER_ID = 'dev'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  data?: object
  /** 静默失败：resolve 出 { __error }，由页面自行处理（如 503 兜底） */
  silent?: boolean
}

function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', data, silent = false } = options
  return new Promise<T>(function (resolve, reject) {
    wx.request({
      url: API_BASE + path,
      method,
      data: data as any,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        'x-user-id': USER_ID
      },
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
