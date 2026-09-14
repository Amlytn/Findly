Component({
  properties: {
    title: {
      type: String,
      value: ''
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
