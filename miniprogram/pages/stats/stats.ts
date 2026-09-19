import { getMe } from '../../services/users'
import { isApiError, fullUrl } from '../../services/request'
import { getCategories, getItems, updateItem } from '../../services/items'
import { getSpaces } from '../../services/spaces'
import { SpaceListItem, ItemListItem } from '../../types/api'

interface StatBarItem {
  id?: string
  name: string
  count: number
  percentage: number
}

/** 下钻弹层的行：items/pending 带图，spaces 纯文字 */
interface DrillRow {
  id: string
  name: string
  img: string
  meta: string
}

type DrillType = 'items' | 'spaces' | 'pending'

const DRILL_TITLE: Record<DrillType, string> = {
  items: '全部物品',
  spaces: '全部空间',
  pending: '待归位物品'
}

Page({
  data: {
    loading: true,
    error: '',
    totalItems: 0,
    totalSpaces: 0,
    unassignedCount: 0,
    topCategories: [] as StatBarItem[],
    topSpaces: [] as StatBarItem[],
    categoryCount: 0,
    spaceWithItemsCount: 0,
    /** 半屏下钻弹层：三个数字框共用，三种模式 */
    popup: {
      open: false,
      type: 'items' as DrillType,
      title: '',
      loading: false,
      error: '',
      rows: [] as DrillRow[],
      truncated: false
    }
  },

  onShow() {
    this.loadStats()
    // 从详情页/位置选择页返回时，若弹层开着则刷新数据（防止展示过期信息）
    if (this.data.popup.open) {
      this.loadPopup(this.data.popup.type)
    }
  },

  loadStats() {
    const that = this
    this.setData({ loading: true, error: '' })

    Promise.all([
      getMe(),
      getCategories().catch(function () {
        return { categories: [] }
      }),
      getSpaces().catch(function () {
        return { list: [], tree: [] }
      })
    ])
      .then(function (results) {
        const me = results[0] as any
        // getMe 为 silent 请求：失败时 resolve 错误对象而非 reject，
        // 必须显式判别，否则会渲染成"全零统计"（error+重试 UI 将不可达）
        if (isApiError(me)) {
          that.setData({
            loading: false,
            error: (me && me.message) || '统计数据加载失败'
          })
          return
        }
        const catsRes = results[1]
        const spacesRes = results[2]

        const totalItems = me && typeof me.itemCount === 'number' ? me.itemCount : 0
        const totalSpaces = me && typeof me.spaceCount === 'number' ? me.spaceCount : 0

        const spaceList: SpaceListItem[] =
          spacesRes && Array.isArray(spacesRes.list) ? spacesRes.list : []

        // 待归位计算：物品总数 - 各空间存放物品数之和（两次接口口径一致，均排除软删除）
        const assignedItems = spaceList.reduce(function (sum: number, s: SpaceListItem) {
          return sum + (s.itemCount || 0)
        }, 0)
        const unassignedCount = Math.max(0, totalItems - assignedItems)

        // 分类分布 Top 5
        const rawCats = catsRes && Array.isArray(catsRes.categories) ? catsRes.categories : []
        const sortedCats = rawCats.slice().sort(function (a, b) {
          return b.count - a.count
        })
        const topCategories: StatBarItem[] = sortedCats.slice(0, 5).map(function (c) {
          return {
            name: c.name || '未分类',
            count: c.count,
            percentage: totalItems > 0 ? Math.round((c.count / totalItems) * 100) : 0
          }
        })

        // 空间分布 Top 5
        const spacesWithItems = spaceList.filter(function (s) {
          return (s.itemCount || 0) > 0
        })
        const sortedSpaces = spacesWithItems.slice().sort(function (a, b) {
          return (b.itemCount || 0) - (a.itemCount || 0)
        })
        const topSpaces: StatBarItem[] = sortedSpaces.slice(0, 5).map(function (s) {
          return {
            id: s.id,
            name: s.name,
            count: s.itemCount || 0,
            percentage:
              totalItems > 0 ? Math.round(((s.itemCount || 0) / totalItems) * 100) : 0
          }
        })

        that.setData({
          loading: false,
          totalItems: totalItems,
          totalSpaces: totalSpaces,
          unassignedCount: unassignedCount,
          topCategories: topCategories,
          topSpaces: topSpaces,
          categoryCount: rawCats.length,
          spaceWithItemsCount: spacesWithItems.length
        })
      })
      .catch(function (err: any) {
        that.setData({
          loading: false,
          error: (err && err.message) || '统计数据加载失败'
        })
      })
  },

  /** 打开下钻弹层（三个数字框共用，data-type 区分模式） */
  openDrill(e: any) {
    const type = (e.currentTarget.dataset.type as DrillType) || 'items'
    this.setData({
      'popup.open': true,
      'popup.type': type,
      'popup.title': DRILL_TITLE[type],
      'popup.loading': true,
      'popup.error': '',
      'popup.rows': [],
      'popup.truncated': false
    })
    this.loadPopup(type)
  },

  closePopup() {
    this.setData({ 'popup.open': false })
  },

  /** 占位：拦截弹层主体的点击冒泡（点遮罩才关闭） */
  noop() {},

  /** 占位：拦截弹层的触摸滚动穿透（背景统计页不随手势滚动） */
  preventTouchMove() {},

  /** 弹层加载失败重试：按当前弹层模式重新拉取（勿把 event 直接当 type 传入） */
  onRetryPopup() {
    this.loadPopup(this.data.popup.type)
  },

  loadPopup(type: DrillType) {
    const that = this
    this.setData({ 'popup.loading': true, 'popup.error': '' })

    // 空间模式：纯文字行（名称 + 件数）
    if (type === 'spaces') {
      getSpaces()
        .then(function (res) {
          const list: SpaceListItem[] = res && Array.isArray(res.list) ? res.list : []
          const rows: DrillRow[] = list.map(function (s) {
            return { id: s.id, name: s.name, img: '', meta: (s.itemCount || 0) + ' 件' }
          })
          that.setData({ 'popup.loading': false, 'popup.rows': rows })
        })
        .catch(function (err: any) {
          that.setData({
            'popup.loading': false,
            'popup.error': (err && err.message) || '加载失败'
          })
        })
      return
    }

    // 物品/待归位模式：拉取物品列表后按模式过滤
    getItems({ page: 1, pageSize: 100 })
      .then(function (res) {
        const all: ItemListItem[] = res && Array.isArray(res.items) ? res.items : []
        const rows: DrillRow[] = []
        for (const it of all) {
          if (type === 'pending' && it.space) continue
          rows.push({
            id: it.id,
            name: it.name,
            img: fullUrl(it.imageUrl) || '/assets/logo.png',
            meta: type === 'pending' ? '尚未归位' : (it.path || '未归位')
          })
        }
        that.setData({
          'popup.loading': false,
          'popup.rows': rows,
          'popup.truncated': (res.total || 0) > 100
        })
      })
      .catch(function (err: any) {
        that.setData({
          'popup.loading': false,
          'popup.error': (err && err.message) || '加载失败'
        })
      })
  },

  /** 弹层行点击：物品/待归位行进详情；空间行仅展示 */
  onRowTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id || this.data.popup.type === 'spaces') return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  /** 待归位 → 位置选择 → PATCH 归位 → 弹层清单与统计数字联动刷新 */
  goAssign(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const that = this
    wx.navigateTo({
      url: '/pages/location/location',
      events: {
        selectLocation(target: { id: string; name: string; path: string[] }) {
          if (!target || !target.id) return
          updateItem(id, { spaceId: target.id })
            .then(function () {
              wx.showToast({ title: '已归位到 ' + target.name, icon: 'success' })
              // 联动刷新：弹层清单（该物品移出待归位）+ 页面统计数字（空间分布变化）
              that.loadPopup('pending')
              that.loadStats()
            })
            .catch(function () {
              /* 失败由 request 层统一 toast */
            })
        }
      }
    })
  }
})
