/**
 * 登录态管理：wx.login code 换 JWT（7 天），本地缓存、提前 1 天续期。
 * M5：dev-token 测试通道兜底已移除——登录失败如实抛错，
 * 后端微信凭据配置问题必须作为真实错误暴露，不再被测试用户掩盖。
 */
import { getApiBase } from './config'
import { getToken, setToken, clearToken } from './token'
import type { LoginResponse } from '../types/api'

export { getToken, clearToken } from './token'

function wxLogin(): Promise<string> {
  return new Promise<string>(function (resolve, reject) {
    wx.login({
      success(res: any) {
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
      url: getApiBase() + path,
      method,
      data,
      timeout: 10000,
      header: { 'Content-Type': 'application/json' },
      success(res: any) {
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

// 登录 Promise 并发锁：避免多处并发调用 ensureLogin 时频繁触发 wx.login 造成 code 互相作废
let inFlightLogin: Promise<string> | null = null

/** 静默登录：拿到可用 token；失败时抛错（启动流程不阻塞，页面自行兜底） */
export function ensureLogin(force = false): Promise<string> {
  if (force) {
    clearToken()
  }
  const cached = getToken()
  if (cached) return Promise.resolve(cached)

  if (inFlightLogin) {
    return inFlightLogin
  }

  inFlightLogin = wxLogin()
    .then(function (code) { return rawRequest<LoginResponse>('POST', '/auth/login', { code }) })
    .then(function (res) {
      if (!res || !res.token) throw { statusCode: 0, message: '登录响应缺少 token' }
      setToken(res.token)
      inFlightLogin = null
      return res.token
    }, function (err) {
      inFlightLogin = null
      throw err
    })

  return inFlightLogin
}

