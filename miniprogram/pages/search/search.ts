import { fullUrl } from '../../services/request'
import { getItems } from '../../services/items'
import { getSuggestions } from '../../services/search'
import { ItemListItem } from '../../types/api'

Page({
  data: {
    kw: '',
    hot: [] as any[],
    suggestions: [] as string[]
  },

  onLoad() {
    const that = this
    getItems({ page: 1, pageSize: 1 }).then(function (res) {
      const first = res.items[0]
      if (!first) return
      // 热门物品卡：适配本页字段（无图用 logo 占位）
      that.setData({
        hot: [Object.assign({}, first, {
          img: fullUrl(first.imageUrl) || '/assets/logo.png',
          space: first.space ? first.space.name : '未归位',
          zone: first.path || '',
          count: 1
        })]
      })
    }).catch(function () { /* 首页展示失败不阻塞搜索 */ })
    getSuggestions().then(function (res) {
      that.setData({ suggestions: res.suggestions || [] })
    }).catch(function () { /* 无建议词则隐藏该区域 */ })
  },

  onInput(e: any) {
    this.setData({ kw: e.detail.value })
  },

  go() {
    if (!this.data.kw.trim()) return
    wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(this.data.kw) })
  },

  goSug(e: any) {
    wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(e.currentTarget.dataset.kw) })
  },

  goDetail(e: any) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  }
})
