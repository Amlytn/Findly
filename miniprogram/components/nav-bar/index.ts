Component({
  properties: {
    title: {
      type: String,
      value: ''
    }
  },
  data: {
    statusBarHeight: 20,
    navTotal: 64
  },
  lifetimes: {
    attached() {
      // 异形屏适配：注入实测的状态栏高度与导航区总高度
      const app = getApp() as any
      const sbh = (app.globalData && app.globalData.statusBarHeight) || 20
      const nbh = (app.globalData && app.globalData.navBarHeight) || 44
      this.setData({ statusBarHeight: sbh, navTotal: sbh + nbh })
    }
  },
  methods: {
    onBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 })
      } else {
        // Tab 页直接进入时（无上级页面），回首页
        wx.switchTab({ url: '/pages/index/index' })
      }
    }
  }
})
