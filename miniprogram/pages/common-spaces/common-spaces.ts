import { getSpaces } from '../../services/spaces'
import { getItems } from '../../services/items'
import { fullUrl } from '../../services/request'
import { SpaceListItem, ItemListItem } from '../../types/api'

interface ShelfItem {
  id: string
  name: string
  img: string
  color: string | null
  category: string
}

interface ShelfData {
  id: string
  name: string
  path: string
  count: number
  items: ShelfItem[]
}

function computeSpacePath(spaceMap: Map<string, SpaceListItem>, id: string): string {
  const parts: string[] = []
  let cur: SpaceListItem | undefined = spaceMap.get(id)
  let guard = 0
  while (cur && guard++ < 20) {
    parts.unshift(cur.name)
    cur = cur.parentId ? spaceMap.get(cur.parentId) : undefined
  }
  return parts.join(' › ')
}

Page({
  data: {
    loading: true,
    error: '',
    empty: false,
    shelves: [] as ShelfData[],
    visibleShelves: [] as ShelfData[],
    activeSpaceId: 'all'
  },

  onLoad(options: any) {
    // 支持从统计页带参进入：filter=pending 直接定位"待归位"分组
    if (options && options.filter === 'pending') {
      this.setData({ activeSpaceId: 'pending' })
    }
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const that = this
    this.setData({ loading: true, error: '' })

    // 任一请求失败都进入 catch 的失败态（PRD 6.4），不与"真的没有数据"混淆
    Promise.all([
      getSpaces(),
      getItems({ page: 1, pageSize: 100 })
    ])
      .then(function (results) {
        const spacesRes = results[0]
        const itemsRes = results[1]

        const spaceList: SpaceListItem[] =
          spacesRes && Array.isArray(spacesRes.list) ? spacesRes.list : []
        const items: ItemListItem[] =
          itemsRes && Array.isArray(itemsRes.items) ? itemsRes.items : []

        // 构建空间映射字典与父子路径
        const spaceMap = new Map<string, SpaceListItem>()
        for (const s of spaceList) {
          spaceMap.set(s.id, s)
        }

        // 按空间归类物品；未指定空间的物品单独收集，构成"待归位"虚拟分组
        const itemsBySpace = new Map<string, ShelfItem[]>()
        const unassigned: ShelfItem[] = []
        for (const it of items) {
          const spId = (it.space && it.space.id) || ''
          if (!spId) {
            unassigned.push({
              id: it.id,
              name: it.name,
              img: fullUrl(it.imageUrl) || '/assets/logo.png',
              color: it.color,
              category: it.category
            })
            continue
          }
          if (!itemsBySpace.has(spId)) {
            itemsBySpace.set(spId, [])
          }
          itemsBySpace.get(spId)!.push({
            id: it.id,
            name: it.name,
            img: fullUrl(it.imageUrl) || '/assets/logo.png',
            color: it.color,
            category: it.category
          })
        }

        // 筛选收纳了物品的有效空间，并按收纳件数倒序
        const spacesWithItems = spaceList.filter(function (s) {
          return (s.itemCount || 0) > 0
        })
        spacesWithItems.sort(function (a, b) {
          return (b.itemCount || 0) - (a.itemCount || 0)
        })

        const shelves: ShelfData[] = spacesWithItems.map(function (s) {
          return {
            id: s.id,
            name: s.name,
            path: computeSpacePath(spaceMap, s.id),
            count: s.itemCount || 0,
            items: itemsBySpace.get(s.id) || []
          }
        })

        // "待归位"虚拟分组：未指定空间的物品排在货架最前（它是待处理项）
        if (unassigned.length > 0) {
          shelves.unshift({
            id: 'pending',
            name: '待归位',
            path: '未指定收纳位置',
            count: unassigned.length,
            items: unassigned
          })
        }

        const empty = shelves.length === 0
        const activeId = that.data.activeSpaceId
        that.setData({
          loading: false,
          empty: empty,
          shelves: shelves,
          visibleShelves: that.filterShelves(shelves, activeId)
        })
      })
      .catch(function (err: any) {
        that.setData({
          loading: false,
          error: (err && err.message) || '加载失败'
        })
      })
  },

  filterShelves(shelves: ShelfData[], activeId: string): ShelfData[] {
    if (activeId === 'all') return shelves
    return shelves.filter(function (s) {
      return s.id === activeId
    })
  },

  onSelectChip(e: any) {
    const id = e.currentTarget.dataset.id || 'all'
    this.setData({
      activeSpaceId: id,
      visibleShelves: this.filterShelves(this.data.shelves, id)
    })
  },

  onItemTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' })
  },

  goManageSpaces() {
    wx.switchTab({ url: '/pages/spaces/spaces' })
  }
})
