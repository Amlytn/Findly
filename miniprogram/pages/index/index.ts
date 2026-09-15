Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    recentItems: [
      { id: 1, name: '无线鼠标', space: '书房', time: '3天前', img: '/assets/item-mouse.jpg' },
      { id: 2, name: '相机', space: '客厅', time: '5天前', img: '/assets/item-camera.jpg' },
      { id: 3, name: '耳机', space: '主卧', time: '7天前', img: '/assets/item-headphone.jpg' }
    ]
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
  },

  onSearch(e: any) {
    const kw = (e.detail.value || '').trim()
    if (kw) {
      wx.showToast({ title: '搜索：' + kw, icon: 'none' })
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
