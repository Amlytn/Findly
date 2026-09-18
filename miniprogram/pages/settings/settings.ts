import { clearToken } from '../../services/token'
import { clearHistory } from '../../utils/search-history'

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
    const app = getApp() as any
    if (app.globalData.version) {
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
    // TODO 上线前补：用户协议/隐私政策静态页（PRD 6.3，需真实文案）
    wx.showToast({ title: e.currentTarget.dataset.t + '（待补充）', icon: 'none' })
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
        // 清 JWT 即游客态（PRD 6.1：游客可浏览，写操作触发重新静默登录）
        clearToken()
        wx.showToast({ title: '已退出', icon: 'success' })
        setTimeout(function () {
          wx.switchTab({ url: '/pages/index/index' })
        }, 800)
      }
    })
  }
})
