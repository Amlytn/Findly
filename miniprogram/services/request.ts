/**
 * wx.request 统一封装：base URL、认证头、超时、错误规整、401 拦截与重登重试。
 * 页面不得直接调 wx.request，一律经 services 业务函数。
 *
 * 认证（契约 v1.3）：优先 Authorization: Bearer <JWT>；
 * 无 token 时保留 x-user-id: dev 兜底（后端过渡期兼容，M5 移除）。
 */
import { ApiError } from '../types/api'
import { getToken, clearToken } from './token'
import { ensureLogin } from './auth'
import { getApiBase, getServerRoot, setServerRoot, fullUrl, SERVER_ROOT, API_BASE } from './config'

export { getApiBase, getServerRoot, setServerRoot, fullUrl, SERVER_ROOT, API_BASE }

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  data?: object
  /** 静默失败：resolve 出 { __error: true }，由页面自行处理（如 503 兜底） */
  silent?: boolean
  /** 内部重试标记：防 401 重试死循环与并发重入 */
  _retry?: boolean
}

export interface RequestSilentError {
  statusCode: number
  message: string
  __error: true
}

// 并发重登锁：多个并发 401 共享单次 ensureLogin 凭据刷新过程
let reloginPromise: Promise<string> | null = null

function handleUnauthorized(): Promise<string> {
  if (!reloginPromise) {
    clearToken()
    reloginPromise = ensureLogin(true).then(
      function (token) {
        reloginPromise = null
        return token
      },
      function (err) {
        reloginPromise = null
        throw err
      }
    )
  }
  return reloginPromise
}

function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', data, silent = false, _retry = false } = options
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
      url: getApiBase() + path,
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

        // 401 拦截处理：清除失效 token 并尝试静默重登后重试
        if (code === 401 && !_retry) {
          const currentToken = getToken()
          // 若其它并发请求已经完成刷新获得了新 token，直接带新 token 重试
          if (currentToken && currentToken !== token) {
            request<T>(path, { ...options, _retry: true }).then(resolve, reject)
            return
          }
          handleUnauthorized()
            .then(
              function () {
                request<T>(path, { ...options, _retry: true }).then(resolve, reject)
              },
              function (loginErr) {
                const err: RequestSilentError = {
                  statusCode: 401,
                  message: (loginErr && loginErr.message) || message,
                  __error: true
                }
                if (silent) {
                  resolve(err as unknown as T & RequestSilentError)
                } else {
                  wx.showToast({ title: err.message.slice(0, 30), icon: 'none' })
                  reject(err)
                }
              }
            )
          return
        }

        const err: RequestSilentError = { statusCode: code, message, __error: true }
        if (silent) {
          resolve(err as unknown as T & RequestSilentError)
        } else {
          wx.showToast({ title: message.slice(0, 30), icon: 'none' })
          reject(err)
        }
      },
      fail() {
        const err: RequestSilentError = { statusCode: 0, message: '网络不可用，请检查后端是否已启动', __error: true }
        if (silent) {
          resolve(err as unknown as T & RequestSilentError)
        } else {
          wx.showToast({ title: err.message, icon: 'none' })
          reject(err)
        }
      }
    })
  })
}

/** silent 模式下判断结果是否为错误 */
export function isApiError(res: unknown): res is RequestSilentError {
  const r = res as Partial<RequestSilentError> | null
  return !!r && (r.__error === true || (typeof r.statusCode === 'number' && (r.statusCode < 200 || r.statusCode >= 300 || r.statusCode === 0)))
}

export default request
