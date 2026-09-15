import { getSearch, SearchType } from '../../services/search'
import { ItemListItem, SearchSpaceItem, ParsedQuery } from '../../types/api'

Page({
  data: {
    kw: '',
    tab: 'all',
    items: [] as any[],
    spaces: [] as any[],
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
    this.setData({ kw: kw, tab: tab, loading: true, error: '' })
    getSearch(kw, tab as SearchType).then(function (res) {
      // 物品卡字段适配本页（meta 预拼，避免 null 显示成 "null"）
      const items = tab === 'space' ? [] : (res.results || []).map(function (it: ItemListItem) {
        const meta = [it.color, it.brand].filter(function (x) { return !!x }).join(' · ')
        return Object.assign({}, it, {
          img: it.imageUrl || '/assets/logo.png',
          meta: meta || '—',
          space: it.space ? it.space.name : '未归位',
          zone: it.path || '',
          count: 1
        })
      })
      const spaces = tab === 'item' ? [] : (res.spaces || []).map(function (s: SearchSpaceItem) {
        return Object.assign({}, s, { pathText: s.path || '' })
      })
      that.setData({
        items: items,
        spaces: spaces,
        parsed: res.parsed || null,
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
