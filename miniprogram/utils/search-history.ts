/**
 * 搜索历史（PRD 图 6）：本地缓存最近 10 条查询，最新在前、去重。
 * 设置页「清除缓存」通过 clearHistory() 联动清理，勿在他处直接操作该 key。
 */
const HISTORY_KEY = 'findly_search_history'
const MAX = 10

export function getHistory(): string[] {
  const list = wx.getStorageSync(HISTORY_KEY)
  return Array.isArray(list) ? list as string[] : []
}

export function pushHistory(kw: string): string[] {
  const q = (kw || '').trim()
  if (!q) return getHistory()
  const list = getHistory().filter(function (t: string) { return t !== q })
  list.unshift(q)
  const next = list.slice(0, MAX)
  wx.setStorageSync(HISTORY_KEY, next)
  return next
}

export function clearHistory(): void {
  wx.removeStorageSync(HISTORY_KEY)
}
