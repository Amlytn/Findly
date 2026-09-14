Page({
  data: {
    groups: [
      { name: '书房', icon: 'book', zones: 2, open: true, children: ['书桌', '右侧抽屉'] },
      { name: '客厅', icon: 'sofa', zones: 2, open: false, children: ['电视柜', '茶几'] },
      { name: '卧室', icon: 'bed', zones: 1, open: false, children: ['床头柜'] },
      { name: '储物间', icon: 'box', zones: 1, open: false, children: ['收纳架'] }
    ],
    selGroup: 0,
    selItem: 0
  },

  toggle(e: any) {
    const i = Number(e.currentTarget.dataset.i)
    const key = 'groups[' + i + '].open'
    const patch: any = {}
    patch[key] = !this.data.groups[i].open
    this.setData(patch)
  },

  select(e: any) {
    this.setData({
      selGroup: Number(e.currentTarget.dataset.i),
      selItem: Number(e.currentTarget.dataset.j)
    })
  },

  confirm() {
    const g = this.data.groups[this.data.selGroup]
    const app = getApp() as any
    app.globalData.locationPath = ['我的家', g.name, g.children[this.data.selItem]]
    wx.navigateBack({ delta: 1 })
  }
})
