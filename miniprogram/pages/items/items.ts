import { getItems, getCategories } from '../../services/items'
import { ItemListItem } from '../../types/api'

const PAGE_SIZE = 20

interface CatChip {
  key: string
  name: string
  count: number
}

Page({
  data: {
    cats: [{ key: 'all', name: '全部', count: 0 }] as CatChip[],
    cat: 'all',
    shown: [] as ItemListItem[],
    page: 1,
    total: 0,
    loading: false,
    finished: false
  },

  onLoad() {
    this.fetchCats()
    this.fetchList(true)
  },

  fetchCats() {
    const that = this
    getCategories().then(function (res) {
      const chips: CatChip[] = [{ key: 'all', name: '全部', count: 0 }]
      res.categories.forEach(function (c) {
        chips.push({ key: c.name, name: c.name, count: c.count })
      })
      that.setData({ cats: chips })
    }).catch(function () { /* chips 拉取失败不阻塞列表 */ })
  },

  /** reset=true 重新从第 1 页拉；false 加载下一页 */
  fetchList(reset: boolean) {
    if (this.data.loading) return
    const that = this
    const page = reset ? 1 : this.data.page + 1
    this.setData({ loading: true })
    const query: { page: number; pageSize: number; keyword?: string } = { page, pageSize: PAGE_SIZE }
    if (this.data.cat !== 'all') query.keyword = this.data.cat
    getItems(query).then(function (res) {
      const shown = reset ? res.items : that.data.shown.concat(res.items)
      that.setData({
        shown,
        page,
        total: res.total,
        loading: false,
        finished: shown.length >= res.total,
        'cats[0].count': res.total
      })
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  setCat(e: any) {
    const key = e.currentTarget.dataset.k
    if (key === this.data.cat) return
    this.setData({ cat: key, shown: [], finished: false })
    this.fetchList(true)
  },

  onPullDownRefresh() {
    const that = this
    this.fetchCats()
    this.fetchList(true)
    setTimeout(function () { wx.stopPullDownRefresh() }, 800)
  },

  onReachBottom() {
    if (!this.data.finished) this.fetchList(false)
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
