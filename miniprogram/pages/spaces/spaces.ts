import { getSpaces } from '../../services/spaces'
import { SpaceTree } from '../../types/api'

interface SpaceRow {
  id: string
  name: string
  zones: number
  items: number
}

/** 汇总某节点整棵子树的物品数（children 已含 itemCount） */
function subtreeItems(node: SpaceTree): number {
  let sum = node.itemCount || 0
  if (node.children) {
    for (const c of node.children) sum += subtreeItems(c)
  }
  return sum
}

function toRow(node: SpaceTree): SpaceRow {
  return {
    id: node.id,
    name: node.name,
    zones: node.children ? node.children.length : 0,
    items: subtreeItems(node)
  }
}

Page({
  data: {
    spaces: [] as SpaceRow[],
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
      const top = (res.tree || []).map(toRow)
      that.setData({ spaces: top, loading: false })
    }).catch(function (e: any) {
      that.setData({ loading: false, error: e.message || '加载失败' })
    })
  },

  goSpace(e: any) {
    wx.showToast({ title: '空间详情开发中', icon: 'none' })
  },

  addSpace() {
    wx.showToast({ title: '添加空间开发中', icon: 'none' })
  },

  retry() {
    this.fetch()
  },

  onShow() {
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 2 })
    }
  }
})
