import { getSpaces, createSpace } from '../../services/spaces'
import { SpaceTree } from '../../types/api'
import { matchSpaceIcon, subtreeCount } from '../../utils/spaces'

interface Row {
  id: string
  name: string
  /** 面包屑完整路径，选中后回填识别结果页 */
  path: string[]
  pathText: string
  depth: number
  total: number
  cardIcon: string
}

function flattenAll(nodes: SpaceTree[], prefix: string[], depth: number, out: Row[]) {
  for (const n of nodes) {
    const path = prefix.concat(n.name)
    const icon = matchSpaceIcon(n.name)
    const total = subtreeCount(n)
    out.push({
      id: n.id,
      name: n.name,
      path: path,
      pathText: path.join(' · '),
      depth: depth,
      total: total,
      cardIcon: icon.card
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

  fetch(autoSelectId?: string) {
    const that = this
    this.setData({ loading: true, error: '' })
    getSpaces().then(function (res) {
      const rows = flattenAll(res.tree || [], [], 0, [])
      let selIndex = that.data.selIndex
      if (autoSelectId) {
        selIndex = rows.findIndex(function (r) { return r.id === autoSelectId })
      }
      that.setData({ rows: rows, selIndex: selIndex, loading: false })
    }).catch(function (e: any) {
      that.setData({ loading: false, error: e.message || '空间加载失败' })
    })
  },

  retry() {
    this.fetch()
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
  },

  /** 允许在位置选择页直接快捷创建新空间，彻底消除首次录物死锁 */
  addNewSpace() {
    const that = this
    wx.showModal({
      title: '新建空间',
      editable: true,
      placeholderText: '如：我的家、书桌、抽屉',
      success(res: any) {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({ title: '空间名称不能为空', icon: 'none' })
          return
        }
        createSpace({ name: name }).then(function (r: any) {
          wx.showToast({ title: '已创建空间', icon: 'success' })
          that.fetch(r && r.id)
        }).catch(function () { /* request 层已统一 toast */ })
      }
    })
  }
})
