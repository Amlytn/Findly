import { getSearch, SearchType } from '../../services/search'
import { ItemListItem, SearchSpaceItem, ParsedQuery } from '../../types/api'

Page({
  data: {
    kw: '',
    tab: 'all',
    items: [] as ItemListItem[],
    spaces: [] as SearchSpaceItem[],
    parsed: null as ParsedQuery | null,
    count: 0,
    loading: true,
    error: ''
  },

  onLoad(query: any) {
    const kw = decodeURIComponent(query.kw || '')
    if (kw) this.apply(kw, 'all')
    else this.setData({ loading: false })
  },

  apply(kw: string, tab: string) {
    const that = this
    this.setData({ kw, tab, loading: true, error: '' })
    getSearch(kw, tab as SearchType).then(function (res) {
      const items = tab === 'space' ? [] : res.results
      const spaces = tab === 'item' ? [] : res.spaces
      that.setData({
        items,
        spaces,
        parsed: res.parsed,
        count: items.length + spaces.length,
        loading: false
      })
    }).catch(function (e: any) {
      that.setData({ loading: false, error: e.message || '搜索失败，点击重试', items: [], spaces: [], count: 0 })
    })
  },

  setTab(e: any) {
    this.apply(this.data.kw, e.currentTarget.dataset.t)
  },

  retry() {
    if (this.data.kw) this.apply(this.data.kw, this.data.tab)
  },

  goDetail(e: any) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  goSpaces() {
    wx.switchTab({ url: '/pages/spaces/spaces' })
  }
})
