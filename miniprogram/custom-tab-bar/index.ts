Component({
  data: {
    selected: 0
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
