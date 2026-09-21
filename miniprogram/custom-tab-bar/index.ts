Component({
  data: {
    selected: 0,
    /** 自定义 tab 栏对 wx.hideTabBar 免疫，弹层需要盖满底部时由页面置 hidden 隐藏 */
    hidden: false
  },
  methods: {
    goTab(e: any) {
      const dataset = e.currentTarget.dataset
      const index = Number(dataset.index)
      if (index === (this as any).data.selected) {
        return
      }
      wx.switchTab({ url: dataset.path })
    },
    goAdd() {
      wx.navigateTo({ url: '/pages/add/add' })
    }
  }
})
