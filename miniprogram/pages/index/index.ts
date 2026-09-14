Page({
  data: {
    recentItems: [
      { id: 1, name: '无线鼠标', space: '书房', count: 1, img: '/assets/item-mouse.jpg' },
      { id: 2, name: '相机', space: '客厅', count: 1, img: '/assets/item-camera.jpg' },
      { id: 3, name: '耳机', space: '卧室', count: 1, img: '/assets/item-headphone.jpg' }
    ],
    spaces: [
      { name: '我的家', zones: 4, count: 12, theme: 'green', icon: 'house' },
      { name: '书房', zones: 2, count: 3, theme: 'blue', icon: 'book' },
      { name: '客厅', zones: 2, count: 4, theme: 'orange', icon: 'sofa' },
      { name: '卧室', zones: 1, count: 2, theme: 'purple', icon: 'bed' }
    ]
  },

  onShow() {
    // 同步自定义 tabBar 的选中态
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 0 })
    }
  },

  onScan() {
    wx.showToast({ title: '扫一扫（待接入）', icon: 'none' })
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

  onSpaceTap(e: any) {
    wx.showToast({ title: '空间详情：' + e.currentTarget.dataset.name, icon: 'none' })
  }
})
