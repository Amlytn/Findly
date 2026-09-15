import { getSpaces } from '../../services/spaces'
import { SpaceTree } from '../../types/api'

interface LeafRow {
  id: string
  name: string
  path: string[]
  icon: string
  zones: number
  open: boolean
  children: LeafRow[]
}

/** 展平：根节点为第一层组；其直接子节点为可选叶子（组内无子再下探一层） */
function flattenTree(tree: SpaceTree[]): LeafRow[] {
  const groups: LeafRow[] = []
  for (const root of tree) {
    const kids = root.children || []
    if (kids.length === 0) {
      groups.push({ id: root.id, name: root.name, path: [root.name], icon: 'book', zones: 0, open: false, children: [] })
      continue
    }
    for (const k of kids) {
      const sub = k.children || []
      groups.push({
        id: k.id,
        name: k.name,
        path: [root.name, k.name],
        icon: 'book',
        zones: sub.length,
        open: false,
        children: sub.length
          ? sub.map(function (s) { return { id: s.id, name: s.name, path: [root.name, k.name, s.name], icon: 'box', zones: 0, open: false, children: [] } })
          : [{ id: k.id, name: k.name, path: [root.name, k.name], icon: 'box', zones: 0, open: false, children: [] }]
      })
    }
  }
  return groups
}

Page({
  data: {
    groups: [] as LeafRow[],
    selGroup: 0,
    selItem: 0,
    loading: true,
    error: ''
  },

  onLoad() {
    this.fetch()
  },

  fetch() {
    const that = this
    this.setData({ loading: true, error: '' })
    getSpaces().then(function (res) {
      const groups = flattenTree(res.tree || [])
      if (groups.length) groups[0].open = true
      that.setData({ groups: groups, loading: false })
    }).catch(function (e: any) {
      that.setData({ loading: false, error: e.message || '空间加载失败' })
    })
  },

  toggle(e: any) {
    const i = Number(e.currentTarget.dataset.i)
    const key = 'groups[' + i + '].open'
    const patch: any = {}
    patch[key] = !this.data.groups[i].open
    this.setData(patch)
  },

  select(e: any) {
    this.setData({
      selGroup: Number(e.currentTarget.dataset.i),
      selItem: Number(e.currentTarget.dataset.j)
    })
  },

  confirm() {
    const g = this.data.groups[this.data.selGroup]
    if (!g) return
    const leaf = g.children[this.data.selItem] || g
    const app = getApp() as any
    app.globalData.locationPath = leaf.path
    app.globalData.locationId = leaf.id
    wx.navigateBack({ delta: 1 })
  }
})
