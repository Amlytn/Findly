/**
 * 登录态管理：wx.login code 换 JWT（7 天），本地缓存、提前 1 天续期。
 * 联调环境后端未配 WX_APPID 时降级 dev-token 测试通道（M5 随 x-user-id 兜底一并移除）。
 */
import { API_BASE } from './request'
import { getToken, setToken } from './token'
import type { DevTokenResponse, LoginResponse } from '../types/api'

export { getToken, clearToken } from './token'

function wxLogin(): Promise<string> {
  return new Promise<string>(function (resolve, reject) {
    wx.login({
      success(res) {
        if (res.code) resolve(res.code)
        else reject({ statusCode: 0, message: 'wx.login 未返回 code' })
      },
      fail() { reject({ statusCode: 0, message: '微信登录调用失败' }) }
    })
  })
}

/** 裸 wx.request（不经 services/request：登录接口本身无需认证头，也避免循环依赖） */
function rawRequest<T>(method: 'GET' | 'POST', path: string, data?: object): Promise<T> {
  return new Promise<T>(function (resolve, reject) {
    wx.request({
      url: API_BASE + path,
      method,
      data,
      timeout: 10000,
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
          return
        }
        const body = res.data as { message?: string } | null
        reject({
          statusCode: res.statusCode,
          message: (body && body.message) || '请求失败（' + res.statusCode + '）'
        })
      },
      fail() { reject({ statusCode: 0, message: '网络不可用，请检查后端是否已启动' }) }
    })
  })
}

/** 静默登录：拿到可用 token；失败时抛错（启动流程不阻塞，页面自行兜底） */
export function ensureLogin(): Promise<string> {
  const cached = getToken()
  if (cached) return Promise.resolve(cached)
  return wxLogin()
    .then(function (code) { return rawRequest<LoginResponse>('POST', '/auth/login', { code }) })
    .catch(function (e: { statusCode?: number }) {
      // 400 = 后端未配置 WX_APPID/WX_APPSECRET（联调环境）→ 测试通道兜底
      if (e && e.statusCode === 400) {
        return rawRequest<DevTokenResponse>('GET', '/auth/dev-token?userId=dev')
      }
      throw e
    })
    .then(function (res) {
      if (!res || !res.token) throw { statusCode: 0, message: '登录响应缺少 token' }
      setToken(res.token)
      return res.token
    })
}
