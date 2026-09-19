import { fullUrl } from '../../services/request'
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
    recentItems: [] as (ItemListItem & { time: string; img: string })[],
    // 首次拉取完成前不渲染空态，避免加载中闪现「去添加」引导；失败态与真空态区分展示
    recentLoaded: false,
    recentFailed: false
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
          img: fullUrl(it.imageUrl) || '/assets/logo.png',
          // space 是 {id,name} 对象，取短名展示
          space: it.space ? it.space.name : '未归位'
        })
      })
      that.setData({ recentItems: recentItems, recentLoaded: true, recentFailed: false })
    }).catch(function () {
      // 拉取失败与真空态区分：失败显示错误态+重试（PRD 6.4），不误导「还没有物品」
      that.setData({ recentLoaded: true, recentFailed: true })
    })
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
    // 横幅圆钮改为新手教程（拍照主入口收敛至下方"拍照识别"卡）
    wx.navigateTo({ url: '/pages/tutorial/tutorial' })
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

  goItems() {
    wx.switchTab({ url: '/pages/items/items' })
  },


  /** 空态引导：去添加第一件物品（与 ➕ Tab 同路径） */
  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' })
  },

  /** 最近添加错误态重试 */
  retryRecent() {
    this.setData({ recentLoaded: false, recentFailed: false })
    this.onShow()
  }
})
