/**
 * 收藏物品本地缓存管理（零后端依赖）：
 * 存储 Key：findly_favorites
 * 存储格式：物品 id 数组，最新收藏在前、唯一去重。
 * 未来后端 Item 表扩展 favorited 字段后，接口可平滑替代本模块。
 */
const FAVORITES_KEY = 'findly_favorites'

export function getFavoriteIds(): string[] {
  try {
    const list = wx.getStorageSync(FAVORITES_KEY)
    return Array.isArray(list) ? (list as string[]).filter(Boolean) : []
  } catch {
    return []
  }
}

export function isFavorite(id: string): boolean {
  if (!id) return false
  return getFavoriteIds().indexOf(id) !== -1
}

/**
 * 切换收藏状态：已收藏则移除，未收藏则插入头部
 * @returns 切换后的最新收藏状态（true 为已收藏）
 */
export function toggleFavorite(id: string): boolean {
  if (!id) return false
  const list = getFavoriteIds()
  const exists = list.indexOf(id) !== -1
  const next = exists
    ? list.filter(function (item) { return item !== id })
    : [id].concat(list)

  try {
    wx.setStorageSync(FAVORITES_KEY, next)
  } catch {
    /* 写入失败静默：与 search-history 同策略，下次操作会重写 */
  }

  return !exists
}

export function removeFavorite(id: string): void {
  if (!id) return
  const list = getFavoriteIds().filter(function (item) { return item !== id })
  try {
    wx.setStorageSync(FAVORITES_KEY, list)
  } catch {
    /* 写入失败静默 */
  }
}

export function clearFavorites(): void {
  try {
    wx.removeStorageSync(FAVORITES_KEY)
  } catch {
    /* 清理失败静默 */
  }
}
