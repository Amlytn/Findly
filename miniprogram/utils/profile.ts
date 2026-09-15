/**
 * 本地用户资料（头像 / 展示 ID）。
 * 后端 User.nickname / avatar 接入写入接口后迁移到云端；当前仅本地持久化。
 */
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
