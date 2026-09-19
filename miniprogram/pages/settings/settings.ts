import { clearToken } from '../../services/auth'
import { clearHistory } from '../../utils/search-history'
import type { IAppOption } from '../../app'

/** storage currentSize 单位 KB → 展示文案 */
function formatCache(kb: number): string {
  if (kb < 1) return '0KB'
  if (kb < 1024) return Math.round(kb) + 'KB'
  return (kb / 1024).toFixed(1) + 'MB'
}

Page({
  data: {
    version: '1.0.0',
    cacheText: '--'
  },

  onLoad() {
    const app = getApp<IAppOption>()
    if (app && app.globalData && app.globalData.version) {
      this.setData({ version: app.globalData.version })
    }
  },

  onShow() {
    this.measureCache()
  },

  measureCache() {
    try {
      const info = wx.getStorageInfoSync()
      this.setData({ cacheText: formatCache(info.currentSize) })
    } catch {
      this.setData({ cacheText: '未知' })
    }
  },

  doc(e: any) {
    const type = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.type) || 'terms'
    wx.navigateTo({ url: '/pages/doc/doc?type=' + type })
  },

  goUsage() {
    wx.navigateTo({ url: '/pages/usage/usage' })
  },

  clearCache() {
    const that = this
    wx.showModal({
      title: '清除缓存',
      content: '确定清除本地缓存（' + this.data.cacheText + '）吗？将清空搜索历史，不影响账号与数据。',
      success(res: any) {
        if (!res.confirm) return
        // 只清可再生的缓存数据；wx.clearStorage 会连 token/资料一起清掉，禁止使用
        clearHistory()
        that.measureCache()
        wx.showToast({ title: '已清除', icon: 'success' })
      }
    })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmColor: '#E06B6B',
      success(res: any) {
        if (!res.confirm) return
        // 清除本地凭证
        clearToken()
        // 清理内存全局临时态
        const app = getApp<IAppOption>()
        if (app && app.globalData) {
          app.globalData.locationPath = []
          app.globalData.locationId = ''
          app.globalData.recognizeImg = ''
          app.globalData.recognizeImgFull = ''
          app.globalData.recognizePending = false
          app.globalData.focusSpaceId = ''
        }
        // 退出后保持游客态（PRD 6.1：游客可浏览，写操作时重新静默登录）。
        // 无需在此立即重登：request 层的 401 拦截会在需要时自动
        // ensureLogin(true) 并重放原请求；当前后端过渡期对无凭据
        // 请求仍以 x-user-id: dev 兜底放行，浏览不受影响。
        wx.showToast({ title: '已退出', icon: 'success' })
        setTimeout(function () {
          wx.switchTab({ url: '/pages/index/index' })
        }, 800)
      }
    })
  }
})
