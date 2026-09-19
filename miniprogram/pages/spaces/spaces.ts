import { getSpaces, createSpace, updateSpace, deleteSpace } from '../../services/spaces'
import { getItems } from '../../services/items'
import { fullUrl } from '../../services/request'
import { SpaceTree, ItemListItem } from '../../types/api'
import { matchSpaceIcon, subtreeCount } from '../../utils/spaces'
import type { IAppOption } from '../../app'

export interface SpaceCardItem {
  id: string
  name: string
  parentId: string | null
  total: number
  directCount?: number
  pathText: string
  cardIcon: string
  glyphIcon: string
  depth: number
  hasChildren: boolean
  children?: SpaceCardItem[]
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

export interface PanelItem extends ItemListItem {
  img: string
  subtitle: string
}

Page({
  data: {
    sections: [] as RootSection[],
    collapsedMap: {} as Record<string, boolean>,
    expandedMap: {} as Record<string, boolean>,
    itemsMap: {} as Record<string, PanelItem[]>,
    itemsCountMap: {} as Record<string, number>,
    loadingMap: {} as Record<string, boolean>,
    loading: true,
    error: '',
    loaded: false,

    // 自定义空间设置弹层
    settingModalVisible: false,
    settingTarget: null as RootSection | SpaceCardItem | null
  },

  onLoad() {
    this.fetch()
  },

  onShow() {
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 2 })
    }
    // 从搜索结果或其他页面带着 focusSpaceId 切回时自动定位并唤起抽屉
    const app = getApp<IAppOption>()
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

        // 递归构建分层嵌套子空间树节点（不平铺，按真实物理层级包含）
        function buildTreeNodes(nodes: SpaceTree[], depth: number, prefix: string[]): SpaceCardItem[] {
          return nodes.map(function (node: SpaceTree) {
            const icons = matchSpaceIcon(node.name)
            const currentPath = prefix.concat(node.name)
            const hasChildren = !!(node.children && node.children.length)
            const children = hasChildren ? buildTreeNodes(node.children!, depth + 1, currentPath) : []
            return {
              id: node.id,
              name: node.name,
              parentId: node.parentId || null,
              total: subtreeCount(node),
              directCount: node.itemCount || 0,
              pathText: currentPath.join(' · '),
              cardIcon: icons.card,
              glyphIcon: icons.glyph,
              depth: depth,
              hasChildren: hasChildren,
              children: children
            }
          })
        }

        const children = (root.children && root.children.length) ? buildTreeNodes(root.children, 1, [root.name]) : []

        return {
          id: root.id,
          name: root.name,
          total: total,
          glyphIcon: rootIcons.glyph,
          cardIcon: rootIcons.card,
          collapsed: !!collapsedMap[root.id],
          children: children
        }
      })

      const expandedMap = Object.assign({}, that.data.expandedMap)

      // 若传入了 focusId，自动展开对应根空间并沿层级展开所有祖先及目标卡片
      if (focusId) {
        function expandAncestors(nodes: SpaceCardItem[], targetId: string): boolean {
          for (const node of nodes) {
            if (node.id === targetId) {
              expandedMap[node.id] = true
              return true
            }
            if (node.children && node.children.length) {
              if (expandAncestors(node.children, targetId)) {
                expandedMap[node.id] = true
                return true
              }
            }
          }
          return false
        }

        for (const s of sections) {
          if (s.id === focusId) {
            s.collapsed = false
            delete collapsedMap[s.id]
            break
          }
          if (expandAncestors(s.children, focusId)) {
            s.collapsed = false
            delete collapsedMap[s.id]
            break
          }
        }
      }

      that.setData({
        sections: sections,
        collapsedMap: collapsedMap,
        expandedMap: expandedMap,
        loading: false,
        loaded: true
      }, function () {
        // focusId 定位：渲染完成后滚到目标空间卡片，否则它可能停在屏幕外
        if (focusId) {
          wx.nextTick(function () {
            wx.pageScrollTo({
              selector: '#space-' + focusId,
              duration: 300
            })
          })
        }
      })

      // 对所有当前已展开的空间刷新或拉取物品列表
      for (const spaceId in expandedMap) {
        if (expandedMap[spaceId]) {
          that.loadSpaceItems(spaceId)
        }
      }
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

  /** 展开 / 收起根空间分组（折叠子空间卡片） */
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

  /** 点击分组头部：无论有无子空间均折叠/展开当前分组 */
  tapSectionHeader(e: any) {
    const sec: RootSection = e.currentTarget.dataset.section
    if (!sec) return
    this.toggleSection({ currentTarget: { dataset: { id: sec.id } } })
  },

  /** 点击子空间卡片：独立展开/收起其内联面板，点击其他卡片不互斥收回，主动点击才收回 */
  tapCard(e: any) {
    const item: SpaceCardItem = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (!item) return
    const isCurrentlyExpanded = !this.data.expandedMap[item.id]
    this.setData({
      ['expandedMap.' + item.id]: isCurrentlyExpanded
    })
    if (isCurrentlyExpanded && !this.data.itemsMap[item.id]) {
      this.loadSpaceItems(item.id)
    }
  },

  onTapCard(e: any) {
    this.tapCard(e)
  },

  /** 加载指定空间下的直属物品列表 */
  loadSpaceItems(spaceId: string) {
    // 在途去重：同一空间的物品请求不重复发起（快速收起→再展开等场景）
    if (this.data.loadingMap && this.data.loadingMap[spaceId]) return
    const that = this
    this.setData({ ['loadingMap.' + spaceId]: true })

    // 后端 pageSize 上限 100；超出部分由组件内"仅显示前 N 件"提示兜底
    getItems({ spaceId: spaceId, page: 1, pageSize: 100 }).then(function (res) {
      const items: PanelItem[] = res.items.map(function (it: ItemListItem) {
        const parts = [it.category, it.color, it.brand].filter(Boolean)
        return Object.assign({}, it, {
          img: fullUrl(it.imageUrl) || '/assets/logo.png',
          subtitle: parts.join(' · ') || '暂无描述'
        })
      })
      that.setData({
        ['itemsMap.' + spaceId]: items,
        // 徽标显示后端直属总数（res.total），而非本页已加载条数（pageSize 上限会截断 items.length）
        ['itemsCountMap.' + spaceId]: typeof res.total === 'number' ? res.total : items.length,
        ['loadingMap.' + spaceId]: false
      })
    }).catch(function () {
      that.setData({ ['loadingMap.' + spaceId]: false })
    })
  },

  /** 根分组设置按钮：唤起自定义空间设置弹层（取代微信原生 UI） */
  onSectionSettings(e: any) {
    const section: RootSection = e.currentTarget.dataset.section
    if (!section) return
    this.setData({
      settingModalVisible: true,
      settingTarget: section
    })
  },

  closeSettingModal() {
    this.setData({ settingModalVisible: false })
  },

  preventBubble() {
    // 阻止点击弹层卡片冒泡到遮罩关闭
  },

  preventTouchMove() {
    // 阻止底层滑动穿透
  },

  /** 弹层操作：重命名空间 */
  onSettingModalRename() {
    const target = this.data.settingTarget
    this.closeSettingModal()
    if (target) {
      this.renameSpace(target)
    }
  },

  /** 弹层操作：删除空间 */
  onSettingModalDelete() {
    const target = this.data.settingTarget
    this.closeSettingModal()
    if (target) {
      this.deleteSpaceConfirm(target)
    }
  },

  /** 根分组右侧加号：在该根空间下快速添加子空间（如：书房、卧室） */
  onSectionAddChild(e: any) {
    const section: RootSection = e.currentTarget.dataset.section
    if (section) this.addChildSpace(section)
  },

  /** 内联面板专属操作栏：重命名 */
  onPanelRename(e: any) {
    const item = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (item) this.renameSpace(item)
  },

  /** 内联面板专属操作栏：在当前空间下快速添加下一级子空间 */
  onPanelAddChild(e: any) {
    const item = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (item) this.addChildSpace(item)
  },

  /** 内联面板专属操作栏：直接向当前空间内加入物品 */
  onPanelAddItem(e: any) {
    const item = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (!item) return
    const app = getApp() as any
    app.globalData.locationId = item.id
    app.globalData.locationPath = item.pathText ? item.pathText.split(' · ') : [item.name]
    wx.navigateTo({ url: '/pages/add/add' })
  },

  /** 内联面板专属操作栏：删除空间 */
  onPanelDelete(e: any) {
    const item = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (item) this.deleteSpaceConfirm(item)
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
          // 确保父分组与父空间处于展开状态，以便立即看见新子空间
          const collapsedMap = Object.assign({}, that.data.collapsedMap)
          delete collapsedMap[parent.id]
          const expandedMap = Object.assign({}, that.data.expandedMap)
          expandedMap[parent.id] = true
          that.setData({ collapsedMap: collapsedMap, expandedMap: expandedMap })
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
          const itemsMap = Object.assign({}, that.data.itemsMap)
          const itemsCountMap = Object.assign({}, that.data.itemsCountMap)
          const loadingMap = Object.assign({}, that.data.loadingMap)
          delete expandedMap[target.id]
          delete itemsMap[target.id]
          delete itemsCountMap[target.id]
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
    const item: SpaceCardItem = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
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

  /** 查看物品详情 */
  goItemDetail(e: any) {
    const id = (e.detail && e.detail.id) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id)
    if (id) {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
    }
  }
})
