import { ITEMS, CATS, catCount } from '../../utils/data'

Page({
  data: {
    cats: CATS,
    counts: [] as number[],
    cat: 'all',
    shown: [] as any[]
  },

  onLoad() {
    const counts = CATS.map(function (c) { return catCount(c.key) })
    this.setData({ counts: counts })
    this.apply('all')
  },

  apply(key: string) {
    this.setData({
      cat: key,
      shown: key === 'all' ? ITEMS.slice() : ITEMS.filter(function (i) { return i.cat === key })
    })
  },

  setCat(e: any) {
    this.apply(e.currentTarget.dataset.k)
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  goDetail(e: any) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  onShow() {
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 1 })
    }
  }
})
