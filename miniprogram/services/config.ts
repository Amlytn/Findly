/**
 * 环境与服务基础配置：支持多环境（开发/体验/生产）自动切换及手动覆盖
 */

const ENV_MAP: Record<string, string> = {
  develop: 'http://localhost:3000',
  trial: 'https://api.findly.app',
  release: 'https://api.findly.app'
}

const STORAGE_SERVER_ROOT_KEY = 'findly_server_root'
let activeServerRoot: string | null = null

/**
 * 获取当前生效的服务端根地址（不带结尾斜杠）
 */
export function getServerRoot(): string {
  if (activeServerRoot) return activeServerRoot
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const persisted = wx.getStorageSync(STORAGE_SERVER_ROOT_KEY)
      if (typeof persisted === 'string' && persisted.trim()) {
        return persisted.trim().replace(/\/+$/, '')
      }
    }
  } catch {
    // 降级兜底
  }
  return ENV_MAP[getEnvVersion()] || ENV_MAP.develop
}

/** 当前运行环境：develop / trial / release；读取失败或非小程序环境按 develop 处理 */
export function getEnvVersion(): string {
  try {
    const accountInfo = typeof wx !== 'undefined' && wx.getAccountInfoSync && wx.getAccountInfoSync()
    const envVersion = accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion
    if (envVersion) return envVersion
  } catch {
    // 降级兜底：低版本或工具环境可能不支持
  }
  return 'develop'
}

/**
 * 允许在运行时配置或测试覆盖服务端根地址
 */
export function setServerRoot(url: string | null): void {
  activeServerRoot = url ? url.trim().replace(/\/+$/, '') : null
}

/**
 * 获取当前生效的 API 基础路径 (/api/v1)
 */
export function getApiBase(): string {
  return getServerRoot() + '/api/v1'
}

/**
 * 上传/图片类接口返回的是相对路径（/uploads/...），<image> 需要完整 URL
 */
export function fullUrl(path: string | null | undefined): string {
  if (!path) return ''
  return /^https?:\/\//.test(path) ? path : getServerRoot() + path
}

/** ⚠️ 快照常量：仅为本模块初次求值时的地址，setServerRoot 切换环境后不会更新。
 * 请求/上传/图片拼接一律使用 getServerRoot() / getApiBase() / fullUrl() 动态函数。 */
export const SERVER_ROOT = getServerRoot()
export const API_BASE = getApiBase()
