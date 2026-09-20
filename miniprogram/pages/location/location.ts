import { getSpaces, createSpace } from '../../services/spaces'
import { SpaceTree, SpaceType } from '../../types/api'
import { resolveSpaceIcon, subtreeCount } from '../../utils/spaces'

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
    const icon = resolveSpaceIcon(n.icon, n.name, n.type)
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
    error: '',
    // 快建空间弹层
    formModalVisible: false,
    formModalTitle: '新建空间'
  },

  onLoad() {
    this.fetch()
  },

  fetch(autoSelectId?: string) {
    const that = this
    this.setData({ loading: true, error: '' })
    getSpaces().then(function (res: any) {
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

  /** 允许在位置选择页直接快捷创建新空间，彻底消除首次录物死锁（弹层化，可选图标） */
  addNewSpace() {
    this.setData({ formModalVisible: true, formModalTitle: '新建空间' })
  },

  onFormCancel() {
    this.setData({ formModalVisible: false })
  },

  onFormConfirm(e: any) {
    const detail = e.detail || {}
    const name: string = detail.name
    const type: SpaceType | undefined = detail.type
    const icon: string | null = detail.icon
    const that = this
    createSpace({ name: name, type: type, icon: icon }).then(function (r: any) {
      wx.showToast({ title: '已创建空间', icon: 'success' })
      that.setData({ formModalVisible: false })
      that.fetch(r && r.id)
    }).catch(function () { /* request 层已统一 toast */ })
  }
})