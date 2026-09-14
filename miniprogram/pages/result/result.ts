Page({
  data: {
    img: '/assets/item-mouse.png',
    score: 92,
    info: {
      brand: 'Logitech',
      category: '电脑配件',
      color: '白色',
      desc: '无线蓝牙鼠标，适用于办公、学习等场景'
    },
    locText: '我的家  ›  书房  ›  书桌'
  },

  onShow() {
    const app = getApp() as any
    const loc: string[] = app.globalData.locationPath || []
    if (loc.length) {
      this.setData({ locText: loc.join('  ›  ') })
    }
    if (app.globalData.recognizeImg) {
      this.setData({ img: app.globalData.recognizeImg })
    }
  },

  changeLoc() {
    wx.navigateTo({ url: '/pages/location/location' })
  },

  save() {
    const app = getApp() as any
    const loc: string[] = app.globalData.locationPath || []
    wx.showToast({
      title: '已保存到' + (loc[loc.length - 1] || '空间'),
      icon: 'success'
    })
    setTimeout(function () {
      wx.switchTab({ url: '/pages/index/index' })
    }, 800)
  }
})
