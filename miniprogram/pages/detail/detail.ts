import { ITEMS, findItem, SUGGESTIONS } from '../../utils/data'

Page({
  data: {
    obj: ITEMS[0] as any,
    tags: [] as string[],
    related: [] as any[],
    suggestions: SUGGESTIONS.slice(0, 3)
  },

  onLoad(query: any) {
    const obj = findItem(Number(query.id)) || ITEMS[7]
    let related = ITEMS.filter(function (i) {
      return i.cat === obj.cat && i.id !== obj.id
    })
    if (related.length < 4) {
      related = related.concat(ITEMS.filter(function (i) {
        return i.cat !== obj.cat && i.id !== obj.id
      }))
    }
    this.setData({
      obj: obj,
      tags: [obj.color, obj.brand],
      related: related.slice(0, 4)
    })
  },

  goDetail(e: any) {
    wx.redirectTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  goSearch(e: any) {
    wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(e.currentTarget.dataset.kw) })
  },

  edit() {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' })
  },

  del() {
    const that = this
    wx.showModal({
      title: '删除物品',
      content: '确定删除「' + (this.data as any).obj.name + '」吗？',
      confirmColor: '#E06B6B',
      success(res: any) {
        if (res.confirm) {
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(function () { wx.navigateBack({ delta: 1 }) }, 600)
        }
      }
    })
  }
})
