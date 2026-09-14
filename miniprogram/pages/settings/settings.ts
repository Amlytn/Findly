Page({
  data: {
    version: '1.0.0'
  },

  onLoad() {
    const app = getApp() as any
    if (app.globalData.version) {
      this.setData({ version: app.globalData.version })
    }
  },

  doc(e: any) {
    wx.showToast({ title: e.currentTarget.dataset.t + '（待补充）', icon: 'none' })
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定清除本地缓存（12.5MB）吗？',
      success: function (res) {
        if (res.confirm) {
          wx.clearStorage()
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmColor: '#E06B6B',
      success: function (res) {
        if (res.confirm) {
          wx.showToast({ title: '已退出（演示）', icon: 'none' })
        }
      }
    })
  }
})
