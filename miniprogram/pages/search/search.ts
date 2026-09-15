import { ITEMS, SUGGESTIONS } from '../../utils/data'

Page({
  data: {
    kw: '',
    hot: [ITEMS[3]], // 无线耳机
    suggestions: SUGGESTIONS.slice(3)
  },

  onInput(e: any) {
    this.setData({ kw: e.detail.value })
  },

  go() {
    wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(this.data.kw) })
  },

  goSug(e: any) {
    wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(e.currentTarget.dataset.kw) })
  },

  goDetail(e: any) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  }
})
