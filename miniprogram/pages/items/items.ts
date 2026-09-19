import { fullUrl } from '../../services/request'
import { getItems, getCategories } from '../../services/items'
import { ItemListItem } from '../../types/api'

const PAGE_SIZE = 20

interface CatChip {
  key: string
  name: string
}

/** 列表卡片字段适配:无图 logo 占位、meta 过滤 null(避免 WXML 渲染出 "null")、space 取短名 */
function mapListItem(it: ItemListItem) {
  const meta = [it.color, it.brand].filter(Boolean).join(' · ')
  return Object.assign({}, it, {
    count: it.quantity || 1,
    img: fullUrl(it.imageUrl) || '/assets/logo.png',
    space: it.space ? it.space.name : '未归位',
    meta: meta
  })
}

Page({
  data: {
    cats: [{ key: 'all', name: '全部' }] as CatChip[],
    counts: [] as number[],
    cat: 'all',
    shown: [] as (ItemListItem & { img: string; count: number; meta: string })[],
    page: 1,
    total: 0,
    loading: false,
    finished: false,
    loaded: false,
    error: '',
    /** 自定义下拉刷新的触发态：true 时刷新器保持展开 */
    refreshing: false,
    /** 刷新槽实时高度（px）：跟随 bindrefresherpulling 的下拉距离，让圆点始终垂直居中于空隙 */
    refresherH: 40
  },

  /** 请求序号:切分类/刷新后按序号丢弃在途旧响应,防止慢响应把新分类列表覆盖成旧分类 */
  reqSeq: 0,

  onLoad() {
    this.fetchCats()
    this.fetchList(true)
  },

  /** 分类 chips:后端真实分类计数(排除软删除),key=分类名(复用 keyword 检索) */
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

  /** reset=true 重新从第 1 页拉;false 加载下一页 */
  fetchList(reset: boolean, onDone?: () => void) {
    const seq = ++this.reqSeq
    const cat = this.data.cat
    const that = this
    const page = reset ? 1 : this.data.page + 1
    this.setData({ loading: true, error: '' })
    const query: { page: number; pageSize: number; category?: string } = { page: page, pageSize: PAGE_SIZE }
    if (cat !== 'all') query.category = cat
    getItems(query).then(function (res) {
      if (seq !== that.reqSeq) {
        if (onDone) onDone()
        return
      }
      const items = res.items.map(mapListItem)
      const shown = reset ? items : that.data.shown.concat(items)
      that.setData({
        shown: shown,
        page: page,
        total: res.total,
        loading: false,
        finished: shown.length >= res.total
      })
      that.syncAllCount(res.total)
      if (onDone) onDone()
    }).catch(function () {
      if (seq !== that.reqSeq) {
        if (onDone) onDone()
        return
      }
      that.setData({ loading: false, error: '物品加载失败，点击重试' })
      if (onDone) onDone()
    })
  },

  /** onShow 静默刷新：并行重拉已加载的 1..N 页（保滚动保分页），按 id 去重拼接；失败保留现有列表 */
  refreshLoaded() {
    const seq = ++this.reqSeq
    const cat = this.data.cat
    const that = this
    const pages = Math.max(1, Math.ceil(this.data.shown.length / PAGE_SIZE))
    const reqs: any[] = []
    for (let p = 1; p <= pages; p++) {
      const query: { page: number; pageSize: number; category?: string } = { page: p, pageSize: PAGE_SIZE }
      if (cat !== 'all') query.category = cat
      reqs.push(getItems(query))
    }
    Promise.all(reqs).then(function (responses) {
      if (seq !== that.reqSeq) return
      const seen: Record<string, boolean> = {}
      const merged: (ItemListItem & { img: string; count: number; meta: string })[] = []
      let total = 0
      responses.forEach(function (res: any, idx: number) {
        if (idx === 0) total = typeof res.total === 'number' ? res.total : total
        res.items.forEach(function (it: ItemListItem) {
          if (seen[it.id]) return
          seen[it.id] = true
          merged.push(mapListItem(it))
        })
      })
      that.setData({
        shown: merged,
        page: pages,
        total: total,
        finished: merged.length >= total,
        error: ''
      })
      that.syncAllCount(total)
    }).catch(function () { /* 静默刷新失败保留现有列表 */ })
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

  retry() {
    this.fetchList(true)
  },

  /** 下拉过程中：刷新槽高度跟随下拉距离，圆点保持垂直居中 */
  onRefresherPulling(e: any) {
    const dy = (e && e.detail && e.detail.dy) || 0
    const h = Math.min(Math.max(dy, 40), 120)
    if (Math.abs(h - this.data.refresherH) >= 2) this.setData({ refresherH: h })
  },

  /** 自定义下拉刷新（scroll-view refresher）：触发态由 refreshing 驱动，完成即收回 */
  onRefresh() {
    if (this.data.refreshing) return
    const that = this
    this.setData({ refreshing: true, refresherH: 50 })
    this.fetchCats()
    this.fetchList(true, function () {
      that.setData({ refreshing: false })
    })
  },

  /** 滚动到底加载下一页（scroll-view bindscrolltolower） */
  onLoadMore() {
    if (this.data.loading || this.data.finished) return
    this.fetchList(false)
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
    // 保存/删除物品后回到本页：静默刷新已加载分页（保滚动保分页），失败保留现有列表
    if (this.data.loaded) {
      this.fetchCats()
      this.refreshLoaded()
    }
    this.data.loaded = true
  }
})
