import { getItems } from '../../services/items'
import { getSuggestions } from '../../services/search'
import { getHistory, pushHistory, clearHistory } from '../../utils/search-history'
import { fallbackImg, mapItemCard } from '../../utils/item-vm'

Page({
  data: {
    kw: '',
    hot: [] as any[],
    suggestions: [] as string[],
    history: [] as string[]
  },

  onLoad() {
    const that = this
    getItems({ page: 1, pageSize: 1 }).then(function (res) {
      const first = res.items[0]
      if (!first) return
      // 热门物品卡：字段适配见 utils/item-vm.ts
      that.setData({ hot: [mapItemCard(first)] })
    }).catch(function () { /* 首页展示失败不阻塞搜索 */ })
    getSuggestions().then(function (res) {
      that.setData({ suggestions: res.suggestions || [] })
    }).catch(function () { /* 无建议词则隐藏该区域 */ })
    this.setData({ history: getHistory() })
  },

  onShow() {
    // 从结果页返回时刷新历史（结果页内可能发生过新搜索）
    this.setData({ history: getHistory() })
  },

  /** 图片加载失败兜底：替换该条的展示图（fallbackImg 内留 console 痕，不静默掩盖） */
  onImgError(e: any) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({ hot: fallbackImg(this.data.hot, idx) })
  },

  onInput(e: any) {
    this.setData({ kw: e.detail.value })
  },

  go() {
    const kw = this.data.kw.trim()
    if (!kw) return
    this.setData({ history: pushHistory(kw) })
    wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(kw) })
  },

  goSug(e: any) {
    const kw = e.currentTarget.dataset.kw
    this.setData({ history: pushHistory(kw) })
    wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(kw) })
  },

  /** 点击历史记录直接检索 */
  goHist(e: any) {
    const kw = e.currentTarget.dataset.kw
    this.setData({ history: pushHistory(kw) })
    wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(kw) })
  },

  /** 清空搜索历史 */
  clearHist() {
    clearHistory()
    this.setData({ history: [] })
    wx.showToast({ title: '已清空', icon: 'none' })
  },

  goDetail(e: any) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  }
})
