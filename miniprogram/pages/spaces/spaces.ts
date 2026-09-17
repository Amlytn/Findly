import { getSpaces, createSpace, updateSpace, deleteSpace } from '../../services/spaces'
import { getItems } from '../../services/items'
import { fullUrl } from '../../services/request'
import { SpaceTree, ItemListItem } from '../../types/api'
import { matchSpaceIcon, subtreeCount } from '../../utils/spaces'

export interface SpaceCardItem {
  id: string
  name: string
  parentId: string | null
  total: number
  pathText: string
  cardIcon: string
  glyphIcon: string
  depth: number
  hasChildren: boolean
}

export interface RootSection {
  id: string
  name: string
  total: number
  glyphIcon: string
  cardIcon: string
  collapsed: boolean
  children: SpaceCardItem[]
}

Page({
  data: {
    sections: [] as RootSection[],
    collapsedMap: {} as Record<string, boolean>,
    selId: '',
    selRow: null as SpaceCardItem | RootSection | null,
    items: [] as (ItemListItem & { img: string; subtitle: string })[],
    itemsLoading: false,
    loading: true,
    error: '',
    loaded: false,
    hasCompany: false,
    hasOther: false
  },

  onLoad() {
    this.fetch()
  },

  onShow() {
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 2 })
    }
    // 从搜索结果或其他页面带着 focusSpaceId 切回时自动定位并选中
    const app = getApp() as any
    const focusId = app && app.globalData && app.globalData.focusSpaceId
    if (focusId) {
      app.globalData.focusSpaceId = ''
      this.fetch(true, focusId)
    } else if (this.data.loaded) {
      this.fetch(true)
    }
  },

  /** 拉取全量空间树并转换为 Section + Cards 结构 */
  fetch(silent?: boolean, focusId?: string) {
    const that = this
    if (!silent) this.setData({ loading: true, error: '' })

    getSpaces().then(function (res) {
      const tree = res.tree || []
      const collapsedMap = that.data.collapsedMap || {}

      const sections: RootSection[] = tree.map(function (root: SpaceTree) {
        const rootIcons = matchSpaceIcon(root.name)
        const total = subtreeCount(root)
        const childrenList: SpaceCardItem[] = []

        // 递归平铺该根空间下的所有后代子空间卡片
        function walk(nodes: SpaceTree[], prefix: string[], depth: number) {
          for (const node of nodes) {
            const path = prefix.concat(node.name)
            const icons = matchSpaceIcon(node.name)
            childrenList.push({
              id: node.id,
              name: node.name,
              parentId: node.parentId || null,
              total: subtreeCount(node),
              pathText: path.join(' · '),
              cardIcon: icons.card,
              glyphIcon: icons.glyph,
              depth: depth,
              hasChildren: !!(node.children && node.children.length)
            })
            if (node.children && node.children.length) {
              walk(node.children, path, depth + 1)
            }
          }
        }

        if (root.children && root.children.length) {
          walk(root.children, [root.name], 1)
        }

        return {
          id: root.id,
          name: root.name,
          total: total,
          glyphIcon: rootIcons.glyph,
          cardIcon: rootIcons.card,
          collapsed: !!collapsedMap[root.id],
          children: childrenList
        }
      })

      // 若当前选中的空间被删除或已不存在，安全重置选中态
      let selRow = that.data.selRow
      let selId = that.data.selId
      if (selId) {
        const exists = sections.some(function (s) {
          return s.id === selId || s.children.some(function (c) { return c.id === selId })
        })
        if (!exists) {
          selId = ''
          selRow = null
        }
      }

      // 若传入了 focusId，自动展开对应根分组并高亮加载直属物品
      if (focusId) {
        let found: any = null
        for (const s of sections) {
          if (s.id === focusId) {
            found = s
            break
          }
          const child = s.children.find(function (c) { return c.id === focusId })
          if (child) {
            found = child
            s.collapsed = false
            delete collapsedMap[s.id]
            break
          }
        }
        if (found) {
          selId = found.id
          selRow = found
          that.loadSpaceItems(found.id)
        }
      }

      const hasCompany = sections.some(function (s) { return s.name.includes('公司') })
      const hasOther = sections.some(function (s) { return s.name.includes('其他') })

      that.setData({
        sections: sections,
        collapsedMap: collapsedMap,
        selId: selId,
        selRow: selRow,
        loading: false,
        loaded: true,
        hasCompany: hasCompany,
        hasOther: hasOther
      })
    }).catch(function (e: any) {
      that.setData({ loading: false, error: e.message || '加载空间失败' })
    })
  },

  retry() {
    this.fetch()
  },

  /** 顶部轻提示 */
  onTipTap() {
    wx.showToast({ title: '建议按 房间 → 家具 → 容器 规划位置', icon: 'none', duration: 2500 })
  },

  /** 展开 / 收起根空间分组 */
  toggleSection(e: any) {
    const id = e.currentTarget.dataset.id
    const collapsedMap = Object.assign({}, this.data.collapsedMap)
    collapsedMap[id] = !collapsedMap[id]

    const sections = this.data.sections.map(function (s) {
      if (s.id === id) {
        return Object.assign({}, s, { collapsed: collapsedMap[id] })
      }
      return s
    })

    this.setData({
      collapsedMap: collapsedMap,
      sections: sections
    })
  },

  /** 点击子空间卡片：已选中则取消（解开死锁），未选中则选中并加载物品 */
  tapCard(e: any) {
    const item: SpaceCardItem = e.currentTarget.dataset.item
    if (!item) return

    // 重复点击同一张卡片：取消选中（关闭物品面板）
    if (this.data.selId === item.id) {
      this.setData({ selId: '', selRow: null, items: [] })
      return
    }

    this.setData({
      selId: item.id,
      selRow: item,
      items: [],
      itemsLoading: true
    })

    this.loadSpaceItems(item.id)
  },

  /** 点击根分组头部：若无子空间则支持选中，若有子空间则折叠/展开 */
  tapSectionHeader(e: any) {
    const section: RootSection = e.currentTarget.dataset.section
    if (!section) return

    // 如果该分组有子空间，默认触发折叠/展开
    if (section.children && section.children.length > 0) {
      this.toggleSection(e)
      return
    }

    // 若无子空间，支持选中以查看其直属物品或添加子空间
    if (this.data.selId === section.id) {
      this.setData({ selId: '', selRow: null, items: [] })
      return
    }

    this.setData({
      selId: section.id,
      selRow: section,
      items: [],
      itemsLoading: true
    })

    this.loadSpaceItems(section.id)
  },

  /** 取消当前选中状态 */
  clearSelection() {
    this.setData({ selId: '', selRow: null, items: [] })
  },

  /** 加载直属物品列表 */
  loadSpaceItems(spaceId: string) {
    const that = this
    getItems({ spaceId: spaceId, page: 1, pageSize: 20 }).then(function (res) {
      const items = res.items.map(function (it: ItemListItem) {
        const parts = [it.category, it.color, it.brand].filter(Boolean)
        return Object.assign({}, it, {
          img: fullUrl(it.imageUrl) || '/assets/logo.png',
          subtitle: parts.join(' · ') || '暂无描述'
        })
      })
      that.setData({ items: items, itemsLoading: false })
    }).catch(function () {
      that.setData({ itemsLoading: false })
    })
  },

  /** 底部大按钮：未选中时添加根空间，选中时在其下添加子空间 */
  onAddButtonTap() {
    if (this.data.selRow) {
      this.addChildSpace(this.data.selRow)
    } else {
      this.addRootSpace()
    }
  },

  /** 新建根空间（如：我的家、公司、宿舍） */
  addRootSpace() {
    const that = this
    wx.showModal({
      title: '添加新空间',
      editable: true,
      placeholderText: '如：我的家、公司、仓库',
      success(res: any) {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({ title: '空间名称不能为空', icon: 'none' })
          return
        }
        createSpace({ name: name }).then(function () {
          wx.showToast({ title: '空间已创建', icon: 'success' })
          that.fetch(true)
        }).catch(function () { /* request 层已 toast */ })
      }
    })
  },

  /** 在指定空间下添加子空间 */
  addChildSpace(parent: SpaceCardItem | RootSection) {
    const that = this
    wx.showModal({
      title: '在「' + parent.name + '」下添加子空间',
      editable: true,
      placeholderText: '如：书房、抽屉、置物架',
      success(res: any) {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({ title: '子空间名称不能为空', icon: 'none' })
          return
        }
        createSpace({ name: name, parentId: parent.id }).then(function () {
          wx.showToast({ title: '子空间已添加', icon: 'success' })
          // 确保父分组处于展开状态，便于用户立刻看见
          const collapsedMap = Object.assign({}, that.data.collapsedMap)
          delete collapsedMap[parent.id]
          that.setData({ collapsedMap: collapsedMap })
          that.fetch(true)
        }).catch(function () { /* request 层已 toast */ })
      }
    })
  },

  /** 重命名空间 */
  renameSpace(target: SpaceCardItem | RootSection) {
    const that = this
    wx.showModal({
      title: '重命名空间',
      editable: true,
      placeholderText: target.name,
      content: target.name,
      success(res: any) {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name || name === target.name) return
        updateSpace(target.id, { name: name }).then(function () {
          wx.showToast({ title: '已修改名称', icon: 'success' })
          that.fetch(true)
        }).catch(function () { /* request 层已 toast */ })
      }
    })
  },

  /** 删除空间（受后端 400 级联约束保护） */
  deleteSpaceConfirm(target: SpaceCardItem | RootSection) {
    const that = this
    wx.showModal({
      title: '删除空间',
      content: '确定要删除「' + target.name + '」吗？若该空间下有子空间或物品，请先移走。',
      confirmColor: '#E06B6B',
      success(res: any) {
        if (!res.confirm) return
        deleteSpace(target.id).then(function () {
          wx.showToast({ title: '已删除空间', icon: 'success' })
          if (that.data.selId === target.id) {
            that.setData({ selId: '', selRow: null, items: [] })
          }
          that.fetch(true)
        }).catch(function () { /* 400 提示由 request 层自动 toast */ })
      }
    })
  },

  /** 卡片长按菜单：重命名 / 添加子空间 / 删除 */
  onCardLongPress(e: any) {
    const item: SpaceCardItem = e.currentTarget.dataset.item
    if (!item) return
    const that = this
    wx.showActionSheet({
      itemList: ['重命名「' + item.name + '」', '在「' + item.name + '」下添加子空间', '删除空间'],
      success(r: any) {
        if (r.tapIndex === 0) {
          that.renameSpace(item)
        } else if (r.tapIndex === 1) {
          that.addChildSpace(item)
        } else if (r.tapIndex === 2) {
          that.deleteSpaceConfirm(item)
        }
      }
    })
  },

  /** 根分组长按菜单 */
  onSectionLongPress(e: any) {
    const section: RootSection = e.currentTarget.dataset.section
    if (!section) return
    const that = this
    wx.showActionSheet({
      itemList: ['在「' + section.name + '」下添加子空间', '重命名「' + section.name + '」', '删除空间'],
      success(r: any) {
        if (r.tapIndex === 0) {
          that.addChildSpace(section)
        } else if (r.tapIndex === 1) {
          that.renameSpace(section)
        } else if (r.tapIndex === 2) {
          that.deleteSpaceConfirm(section)
        }
      }
    })
  },

  /** 快捷操作入口（面板内按钮触发） */
  onPanelRename() {
    if (this.data.selRow) this.renameSpace(this.data.selRow)
  },

  onPanelAddChild() {
    if (this.data.selRow) this.addChildSpace(this.data.selRow)
  },

  onPanelDelete() {
    if (this.data.selRow) this.deleteSpaceConfirm(this.data.selRow)
  },

  /** 查看物品详情 */
  goItemDetail(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
    }
  },

  /** 快捷添加推荐的根空间（如：公司、其他空间） */
  quickAddPreset(e: any) {
    const name = e.currentTarget.dataset.name
    if (!name) return
    const that = this
    createSpace({ name }).then(function () {
      wx.showToast({ title: '已添加「' + name + '」', icon: 'success' })
      that.fetch(true)
    }).catch(function () { /* request 层已 toast */ })
  }
})
