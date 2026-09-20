/**
 * 本地用户资料缓存（头像 / 展示 ID）。
 * 真相源已迁云端（PATCH /users/me，契约 v1.4）；此处仅作离线兜底缓存：
 * avatar 存云端相对路径（/uploads/...）或本地持久文件路径，渲染时经 fullUrl 归一。
 */
import { fullUrl } from '../services/config'

export const PROFILE_KEY = 'findly_profile'
export const DEFAULT_ID = 'Findly_001'

export interface UserProfile {
  id: string
  avatar: string
}

export function loadProfile(): UserProfile {
  return (wx.getStorageSync(PROFILE_KEY) as UserProfile) || { id: DEFAULT_ID, avatar: '' }
}

export function saveProfile(profile: UserProfile): void {
  wx.setStorageSync(PROFILE_KEY, profile)
}

/** 头像渲染地址：云端相对路径拼服务端前缀，本地文件路径原样使用 */
export function avatarUrl(avatar: string | null | undefined): string {
  if (!avatar) return ''
  if (avatar.indexOf('/uploads/') === 0) return fullUrl(avatar)
  return avatar
}
