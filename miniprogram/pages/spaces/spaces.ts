import { getSpaces, createSpace, updateSpace, deleteSpace } from '../../services/spaces'
import { getItems } from '../../services/items'
import { SpaceTree, ItemListItem } from '../../types/api'

interface Row {
  id: string
  name: string
  /** 面包屑完整路径 */
  pathText: string
  /** 缩进 rpx（按树深） */
  pad: number
  depth: number
  /** 子树物品合计 */
  total: number
}

function subtreeCount(node: SpaceTree): number {
  let sum = node.itemCount || 0
  for (const c of node.children || []) sum += subtreeCount(c)
  return sum
}

/** 递归展平：任意深度全部展示（与位置选择页同一范式） */
function flattenAll(nodes: SpaceTree[], prefix: string[], depth: number, out: Row[]) {
  for (const n of nodes) {
    const path = prefix.concat(n.name)
    out.push({
      id: n.id,
      name: n.name,
      pathText: path.join(' › '),
      pad: 24 + depth * 40,
      depth,
      total: subtreeCount(n)
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
    selRow: null as Row | null,
    items: [] as ItemListItem[],
    itemsLoading: false,
    loaded: false,
    loading: true,
    error: ''
  },

  onLoad() {
    this.fetch()
  },

  onShow() {
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 2 })
    }
    // 从详情/添加返回时静默刷新（onLoad 已拉过一次，避免首进双请求）
    if (this.data.loaded) this.fetch(true)
  },

  fetch(silent?: boolean) {
    const that = this
    if (!silent) this.setData({ loading: true, error: '' })
    getSpaces().then(function (res) {
      that.setData({ rows: flattenAll(res.tree || [], [], 0, []), loading: false, loaded: true })
    }).catch(function (e: any) {
      that.setData({ loading: false, error: e.message || '加载失败' })
    })
  },

  retry() {
    this.fetch()
  },

  /** 点空间：选中并展示该空间直接存放的物品 */
  tapRow(e: any) {
    const i = Number(e.currentTarget.dataset.i)
    const row = this.data.rows[i]
    this.setData({ selIndex: i, selRow: row, items: [], itemsLoading: true })
    const that = this
    getItems({ page: 1, pageSize: 20, spaceId: row.id }).then(function (res) {
      that.setData({ items: res.items, itemsLoading: false })
    }).catch(function () {
      that.setData({ itemsLoading: false })
    })
  },

  /** 添加空间：选中了空间则作为其子空间，否则作为根空间 */
  addSpace() {
    const sel = this.data.selRow
    const that = this
    wx.showModal({
      title: sel ? '在「' + sel.name + '」下添加子空间' : '添加空间',
      editable: true,
      placeholderText: '空间名称，如：书房',
      success(res: any) {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({ title: '名称不能为空', icon: 'none' })
          return
        }
        const body: { name: string; parentId?: string } = { name: name }
        if (sel) body.parentId = sel.id
        createSpace(body).then(function () {
          wx.showToast({ title: '已添加', icon: 'success' })
          that.fetch(true)
        }).catch(function () { /* request 层已 toast */ })
      }
    })
  },

  /** 长按空间：重命名 / 添加子空间 / 删除（删除保护由后端 400 拦截并 toast） */
  rowLongPress(e: any) {
    const row = this.data.rows[Number(e.currentTarget.dataset.i)]
    const that = this
    wx.showActionSheet({
      itemList: ['重命名', '添加子空间', '删除'],
      success(r: any) {
        if (r.tapIndex === 0) {
          wx.showModal({
            title: '重命名「' + row.name + '」',
            editable: true,
            placeholderText: row.name,
            success(res: any) {
              if (!res.confirm) return
              const name = (res.content || '').trim()
              if (!name) return
              updateSpace(row.id, { name: name }).then(function () {
                wx.showToast({ title: '已保存', icon: 'success' })
                that.fetch(true)
              }).catch(function () { /* request 层已 toast */ })
            }
          })
        } else if (r.tapIndex === 1) {
          wx.showModal({
            title: '在「' + row.name + '」下添加子空间',
            editable: true,
            placeholderText: '空间名称',
            success(res: any) {
              if (!res.confirm) return
              const name = (res.content || '').trim()
              if (!name) return
              createSpace({ name: name, parentId: row.id }).then(function () {
                wx.showToast({ title: '已添加', icon: 'success' })
                that.fetch(true)
              }).catch(function () { /* request 层已 toast */ })
            }
          })
        } else {
          wx.showModal({
            title: '删除空间',
            content: '确定删除「' + row.name + '」吗？',
            confirmColor: '#E06B6B',
            success(res: any) {
              if (!res.confirm) return
              deleteSpace(row.id).then(function () {
                wx.showToast({ title: '已删除', icon: 'success' })
                if (that.data.selRow && that.data.selRow.id === row.id) {
                  that.setData({ selIndex: -1, selRow: null, items: [] })
                }
                that.fetch(true)
              }).catch(function () { /* 400 保护信息由 request 层 toast */ })
            }
          })
        }
      }
    })
  },

  goItem(e: any) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  }
})
