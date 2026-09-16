import { getSpaces } from '../../services/spaces'
import { SpaceTree } from '../../types/api'

interface Row {
  id: string
  name: string
  /** 面包屑完整路径，选中后回填识别结果页 */
  path: string[]
  pathText: string
  /** 缩进 rpx（按树深） */
  pad: number
  depth: number
  itemCount: number
}

/** 递归展平：任意深度的空间树全部可选（避免 3 层截断导致深层空间选不到） */
function flattenAll(nodes: SpaceTree[], prefix: string[], depth: number, out: Row[]) {
  for (const n of nodes) {
    const path = prefix.concat(n.name)
    out.push({
      id: n.id,
      name: n.name,
      path,
      pathText: depth === 0 ? (n.itemCount || 0) + ' 件物品' : path.join(' › '),
      pad: 24 + depth * 40,
      depth,
      itemCount: n.itemCount || 0
    })
    if (n.children && n.children.length) {
      flattenAll(n.children, path, depth + 1, out)
    }
  }
  return out
}

Page({
  data: {
    rows: [] as Row[],
    selIndex: -1,
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
      that.setData({ rows: flattenAll(res.tree || [], [], 0, []), loading: false })
    }).catch(function (e: any) {
      that.setData({ loading: false, error: e.message || '空间加载失败' })
    })
  },

  select(e: any) {
    this.setData({ selIndex: Number(e.currentTarget.dataset.i) })
  },

  confirm() {
    const row = this.data.rows[this.data.selIndex]
    if (!row) {
      wx.showToast({ title: '请先选择位置', icon: 'none' })
      return
    }
    const channel = typeof (this as any).getOpenerEventChannel === 'function' ? (this as any).getOpenerEventChannel() : null
    if (channel && typeof channel.emit === 'function') {
      channel.emit('selectLocation', { id: row.id, name: row.name, path: row.path })
    }
    const app = getApp() as any
    app.globalData.locationPath = row.path
    app.globalData.locationId = row.id
    wx.navigateBack({ delta: 1 })
  }
})
