import { getItems } from '../../services/items'
import { ItemListItem } from '../../types/api'

/** updatedAt → 相对时间文案 */
function timeAgo(iso?: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d <= 0) return '今天'
  if (d < 30) return d + '天前'
  const m = Math.floor(d / 30)
  if (m < 12) return m + '个月前'
  return Math.floor(m / 12) + '年前'
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    recentItems: [] as (ItemListItem & { time: string; img: string })[]
  },

  onShow() {
    // 异形屏适配：实测状态栏/导航栏高度
    const app = getApp() as any
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight
    })
    // 同步自定义 tabBar 的选中态
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 0 })
    }
    // 每次回首页刷新最近添加（保存物品后回首页即可看到），失败静默
    const that = this
    getItems({ page: 1, pageSize: 3 }).then(function (res) {
      const recentItems = res.items.map(function (it: ItemListItem) {
        return Object.assign({}, it, {
          time: timeAgo(it.updatedAt),
          img: it.imageUrl || '/assets/logo.png'
        })
      })
      that.setData({ recentItems: recentItems })
    }).catch(function () { /* 后端未启动时首页保持空白，不阻塞浏览 */ })
  },

  onSearch(e: any) {
    const kw = (e.detail.value || '').trim()
    if (kw) {
      wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(kw) })
    }
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  onHeroTap() {
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  onItemTap(e: any) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  goCamera() {
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  goSpaces() {
    wx.switchTab({ url: '/pages/spaces/spaces' })
  },

  goRecent() {
    wx.switchTab({ url: '/pages/items/items' })
  },

  goItems() {
    wx.switchTab({ url: '/pages/items/items' })
  }
})
