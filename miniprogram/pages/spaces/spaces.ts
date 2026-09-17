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
    expandedMap: {} as Record<string, boolean>,
    itemsMap: {} as Record<string, (ItemListItem & { img: string; subtitle: string })[]>,
    itemsCountMap: {} as Record<string, number>,
    loadingMap: {} as Record<string, boolean>,
    loading: true,
    error: '',
    loaded: false
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

      const expandedMap = Object.assign({}, that.data.expandedMap)

      // 若传入了 focusId，自动展开对应根分组并高亮加载直属物品
      if (focusId) {
        for (const s of sections) {
          if (s.id === focusId) {
            expandedMap[s.id] = true
            that.loadSpaceItems(s.id)
            break
          }
          const child = s.children.find(function (c) { return c.id === focusId })
          if (child) {
            s.collapsed = false
            delete collapsedMap[s.id]
            expandedMap[child.id] = true
            that.loadSpaceItems(child.id)
            break
          }
        }
      }

      // 若有已展开的空间，静默刷新其物品列表
      Object.keys(expandedMap).forEach(function (spaceId) {
        if (expandedMap[spaceId] && (!that.data.itemsMap[spaceId] || silent)) {
          that.loadSpaceItems(spaceId)
        }
      })

      that.setData({
        sections: sections,
        collapsedMap: collapsedMap,
        expandedMap: expandedMap,
        loading: false,
        loaded: true
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

  /** 展开 / 收起根空间分组（不影响各子空间卡片的独立展开状态） */
  toggleSection(e: any) {
    const id = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || (e.target && e.target.dataset && e.target.dataset.id)
    if (!id) return

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

  /** 点击子空间卡片：独立展开/收起物品面板，点击其他控件互不影响，需主动再次点击收起 */
  tapCard(e: any) {
    const item: SpaceCardItem = e.currentTarget.dataset.item
    if (!item) return

    const isExpanded = !this.data.expandedMap[item.id]
    const expandedMap = Object.assign({}, this.data.expandedMap, {
      [item.id]: isExpanded
    })

    this.setData({ expandedMap: expandedMap })

    // 若展开且该空间的物品列表尚未加载，立即发起请求加载
    if (isExpanded && !this.data.itemsMap[item.id]) {
      this.loadSpaceItems(item.id)
    }
  },

  /** 点击根分组头部：若有子空间则折叠/展开；若无子空间则展开/收起物品面板 */
  tapSectionHeader(e: any) {
    const section: RootSection = e.currentTarget.dataset.section
    if (!section) return

    // 如果该分组有子空间，触发折叠/展开
    if (section.children && section.children.length > 0) {
      this.toggleSection(e)
      return
    }

    // 若无子空间，独立展开/收起物品面板
    const isExpanded = !this.data.expandedMap[section.id]
    const expandedMap = Object.assign({}, this.data.expandedMap, {
      [section.id]: isExpanded
    })

    this.setData({ expandedMap: expandedMap })

    if (isExpanded && !this.data.itemsMap[section.id]) {
      this.loadSpaceItems(section.id)
    }
  },

  /** 加载指定空间的直属物品列表 */
  loadSpaceItems(spaceId: string) {
    const that = this
    const loadingMap = Object.assign({}, this.data.loadingMap, { [spaceId]: true })
    this.setData({ loadingMap: loadingMap })

    getItems({ spaceId: spaceId, page: 1, pageSize: 20 }).then(function (res) {
      const items = res.items.map(function (it: ItemListItem) {
        const parts = [it.category, it.color, it.brand].filter(Boolean)
        return Object.assign({}, it, {
          img: fullUrl(it.imageUrl) || '/assets/logo.png',
          subtitle: parts.join(' · ') || '暂无描述'
        })
      })
      const itemsMap = Object.assign({}, that.data.itemsMap, { [spaceId]: items })
      const itemsCountMap = Object.assign({}, that.data.itemsCountMap, { [spaceId]: items.length })
      const lMap = Object.assign({}, that.data.loadingMap, { [spaceId]: false })
      that.setData({ itemsMap: itemsMap, itemsCountMap: itemsCountMap, loadingMap: lMap })
    }).catch(function () {
      const lMap = Object.assign({}, that.data.loadingMap, { [spaceId]: false })
      that.setData({ loadingMap: lMap })
    })
  },

  /** 底部大按钮：常驻创建新空间 */
  onAddButtonTap() {
    this.addRootSpace()
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
          const expandedMap = Object.assign({}, that.data.expandedMap)
          delete expandedMap[target.id]
          const itemsMap = Object.assign({}, that.data.itemsMap)
          delete itemsMap[target.id]
          const itemsCountMap = Object.assign({}, that.data.itemsCountMap)
          delete itemsCountMap[target.id]
          const loadingMap = Object.assign({}, that.data.loadingMap)
          delete loadingMap[target.id]
          that.setData({
            expandedMap: expandedMap,
            itemsMap: itemsMap,
            itemsCountMap: itemsCountMap,
            loadingMap: loadingMap
          })
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
  onPanelRename(e: any) {
    const item = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (item) this.renameSpace(item)
  },

  onPanelAddChild(e: any) {
    const item = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (item) this.addChildSpace(item)
  },

  onPanelDelete(e: any) {
    const item = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (item) this.deleteSpaceConfirm(item)
  },

  /** 查看物品详情 */
  goItemDetail(e: any) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
    }
  }
})
