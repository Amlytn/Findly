import { searchItems, searchSpaces } from '../../utils/data'

Page({
  data: {
    kw: '',
    tab: 'all',
    items: [] as any[],
    spaces: [] as any[],
    count: 0
  },

  onLoad(query: any) {
    const kw = decodeURIComponent(query.kw || '')
    this.apply(kw, 'all')
  },

  apply(kw: string, tab: string) {
    const items = tab === 'space' ? [] : searchItems(kw)
    const spaces = tab === 'item' ? [] : searchSpaces(kw)
    this.setData({
      kw: kw,
      items: items,
      spaces: spaces,
      tab: tab,
      count: items.length + spaces.length
    })
  },

  setTab(e: any) {
    this.apply(this.data.kw, e.currentTarget.dataset.t)
  },

  goDetail(e: any) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  goSpaces() {
    wx.switchTab({ url: '/pages/spaces/spaces' })
  }
})
