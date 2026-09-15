import { fullUrl } from '../../services/request'
import { getItems, getCategories } from '../../services/items'
import { ItemListItem } from '../../types/api'

const PAGE_SIZE = 20

interface CatChip {
  key: string
  name: string
}

Page({
  data: {
    cats: [{ key: 'all', name: '全部' }] as CatChip[],
    counts: [] as number[],
    cat: 'all',
    shown: [] as (ItemListItem & { img: string; count: number })[],
    page: 1,
    total: 0,
    loading: false,
    finished: false,
    loaded: false
  },

  onLoad() {
    this.fetchCats()
    this.fetchList(true)
  },

  /** 分类 chips：后端真实分类计数（排除软删除），key=分类名（复用 keyword 检索） */
  fetchCats() {
    const that = this
    getCategories().then(function (res) {
      const cats: CatChip[] = [{ key: 'all', name: '全部' }]
      const counts: number[] = [0]
      res.categories.forEach(function (c) {
        cats.push({ key: c.name, name: c.name })
        counts.push(c.count)
      })
      that.setData({ cats: cats, counts: counts })
    }).catch(function () { /* chips 拉取失败不阻塞列表 */ })
  },

  /** reset=true 重新从第 1 页拉；false 加载下一页 */
  fetchList(reset: boolean) {
    if (this.data.loading) return
    const that = this
    const page = reset ? 1 : this.data.page + 1
    this.setData({ loading: true })
    const query: { page: number; pageSize: number; keyword?: string } = { page: page, pageSize: PAGE_SIZE }
    if (this.data.cat !== 'all') query.keyword = this.data.cat
    getItems(query).then(function (res) {
      const items = res.items.map(function (it: ItemListItem) {
        // quantity 列表接口未返回，默认 1；无图用 logo 占位（M4 上传后显示真图）
        // space 是 {id,name} 对象，取短名展示（修复卡片显示 [object Object]）
        return Object.assign({}, it, {
          count: 1,
          img: fullUrl(it.imageUrl) || '/assets/logo.png',
          space: it.space ? it.space.name : '未归位'
        })
      })
      const shown = reset ? items : that.data.shown.concat(items)
      that.setData({
        shown: shown,
        page: page,
        total: res.total,
        loading: false,
        finished: shown.length >= res.total
      })
      that.syncAllCount(res.total)
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  /** "全部" chip 的计数 = 后端 total */
  syncAllCount(total: number) {
    const idx = this.data.cats.findIndex(function (c) { return c.key === 'all' })
    if (idx >= 0) {
      const patch: any = {}
      patch['counts[' + idx + ']'] = total
      this.setData(patch)
    }
  },

  setCat(e: any) {
    const key = e.currentTarget.dataset.k
    if (key === this.data.cat) return
    this.setData({ cat: key, shown: [], finished: false })
    this.fetchList(true)
  },

  onPullDownRefresh() {
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
    // 保存/删除物品后回到本页时静默刷新
    if (this.data.loaded) {
      this.fetchCats()
      this.fetchList(true)
    }
    this.data.loaded = true
  }
})
