/**
 * JWT 本地缓存：独立于 request/auth，避免二者循环依赖。
 * JWT 7 天有效，本地缓存提前 1 天视为过期（续期走重新登录）。
 */
const TOKEN_KEY = 'findly_token'
const TOKEN_TTL = 6 * 24 * 3600 * 1000

export function getToken(): string {
  const cached = wx.getStorageSync(TOKEN_KEY) as { token: string; ts: number } | ''
  if (cached && cached.token && Date.now() - cached.ts < TOKEN_TTL) return cached.token
  return ''
}

export function setToken(token: string): void {
  wx.setStorageSync(TOKEN_KEY, { token: token, ts: Date.now() })
}

export function clearToken(): void {
  wx.removeStorageSync(TOKEN_KEY)
}
