Page({
  goItems() {
    wx.switchTab({ url: '/pages/items/items' })
  },

  goSpaces() {
    wx.switchTab({ url: '/pages/spaces/spaces' })
  },

  goFamily() {
    wx.showToast({ title: '家庭功能敬请期待', icon: 'none' })
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onShow() {
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 3 })
    }
  }
})
