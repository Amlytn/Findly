/**
 * 空间树状态 store —— 空间管理页（spaces）的树 / 展开 / 物品状态的唯一权威源，
 * 同时承担 location / common-spaces 的空间数据出处。
 *
 * 设计目标（待改项 S1 / S2 / S5）：
 * - 消除 spaces 页 data 上五个 Map（expandedMap/itemsMap/itemsCountMap/loadingMap/collapsedMap）
 *   的散写，状态变更全部收敛到本 store，页面只做渲染与事件转发；
 * - 新建 / 改名 / 删除等操作成功后只做「本地树变更 + sections 重建」，不整树 fetch；
 *   整树请求只发生在：首次进入、focusId 定位、显式 refresh（下拉刷新）。
 *   —— 由此保留全部展开态与已加载物品缓存，不再触发已展开空间的重复请求；
 * - 图标解析统一走 resolveSpaceIcon（Space.icon 字段优先，无 icon 时名称匹配兜底）。
 */
import { getSpaces, createSpace, updateSpace, deleteSpace } from '../services/spaces'
import { getItems } from '../services/items'
import { SpaceTree, SpaceListItem, SpaceType } from '../types/api'
import { resolveSpaceIcon } from './spaces'
import { ItemCardVM, mapItemCard } from './item-vm'
import { joinPath } from './space-path'

/** 空间卡片视图节点（spaces 页空间卡片流） */
export interface SpaceCardItem {
  id: string
  name: string
  parentId: string | null
  total: number
  directCount?: number
  pathText: string
  /** 祖先路径数组（含自身）：跨页传参用，避免再切 pathText 字符串 */
  pathArr: string[]
  cardIcon: string
  glyphIcon: string
  depth: number
  hasChildren: boolean
  type?: SpaceType | null
  icon?: string | null
  children?: SpaceCardItem[]
}

/** 根空间分组（section） */
export interface RootSection {
  id: string
  name: string
  total: number
  glyphIcon: string
  cardIcon: string
  collapsed: boolean
  type?: SpaceType | null
  icon?: string | null
  children: SpaceCardItem[]
}

/** 面板内物品行（复用列表卡片 VM + 副标题） */
export interface PanelItem extends ItemCardVM {
  subtitle: string
}

/** 可 setData 的补丁（页面 data 的子集） */
export interface StorePatch {
  sections?: RootSection[]
  expandedMap?: Record<string, boolean>
  collapsedMap?: Record<string, boolean>
  itemsMap?: Record<string, PanelItem[]>
  itemsCountMap?: Record<string, number>
  loadingMap?: Record<string, boolean>
  loading?: boolean
  error?: string
  loaded?: boolean
}

/** 页面最小接口：store 通过 setData 回写（兼容 wx Page 实例） */
type Owner = {
  data: Record<string, any>
  setData(data: Record<string, any>, cb?: () => void): void
}

function subtreeTotal(node: SpaceTree): number {
  let sum = node.itemCount || 0
  for (const c of node.children || []) sum += subtreeTotal(c)
  return sum
}

function buildCardNode(node: SpaceTree, depth: number, prefix: string[]): SpaceCardItem {
  const currentPath = prefix.concat(node.name)
  const icons = resolveSpaceIcon(node.icon, node.name, node.type)
  const hasChildren = !!(node.children && node.children.length)
  return {
    id: node.id,
    name: node.name,
    parentId: node.parentId || null,
    total: subtreeTotal(node),
    directCount: node.itemCount || 0,
    pathText: joinPath(currentPath),
    pathArr: currentPath,
    cardIcon: icons.card,
    glyphIcon: icons.glyph,
    depth: depth,
    hasChildren: hasChildren,
    type: node.type || null,
    icon: node.icon || null,
    children: hasChildren
      ? node.children!.map(function (c) { return buildCardNode(c, depth + 1, currentPath) })
      : []
  }
}

function buildSection(root: SpaceTree, collapsedMap: Record<string, boolean>): RootSection {
  const icons = resolveSpaceIcon(root.icon, root.name, root.type)
  return {
    id: root.id,
    name: root.name,
    total: subtreeTotal(root),
    glyphIcon: icons.glyph,
    cardIcon: icons.card,
    collapsed: !!collapsedMap[root.id],
    type: root.type || null,
    icon: root.icon || null,
    children: (root.children && root.children.length)
      ? root.children.map(function (c) { return buildCardNode(c, 1, [root.name]) })
      : []
  }
}

/** 深度查找节点（操作成功后本地更新用）；返回节点与其父容器 */ 
function findNode(nodes: SpaceTree[], id: string): { node: SpaceTree; parent: SpaceTree[] } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { node: nodes[i], parent: nodes }
    if (nodes[i].children && nodes[i].children.length) {
      const found = findNode(nodes[i].children!, id)
      if (found) return found
    }
  }
  return null
}

/** 收集某节点及其全部后代的 id（删除后清理状态用） */
function collectSubtreeIds(node: SpaceTree, out: string[]): void {
  out.push(node.id)
  for (const c of node.children || []) collectSubtreeIds(c, out)
}

/** 从嵌套数组中移除目标 id 所在节点；返回是否移除成功 */
function removeNodeById(nodes: SpaceTree[], id: string): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      nodes.splice(i, 1)
      return true
    }
    if (nodes[i].children && nodes[i].children.length && removeNodeById(nodes[i].children!, id)) {
      return true
    }
  }
  return false
}

export class SpaceTreeStore {
  private owner: Owner
  /** 后端原始树缓存 —— 本地操作直接改它再重建 sections */
  private cacheTree: SpaceTree[] = []
  private cacheList: SpaceListItem[] = []

  constructor(owner: Owner) {
    this.owner = owner
  }

  // ---------- 全量拉取（首次 / 刷新 / focusId 定位） ----------

  fetch(silent?: boolean, focusId?: string): Promise<void> {
    const that = this
    const owner = this.owner
    if (!silent) owner.setData({ loading: true, error: '' })

    return getSpaces().then(function (res: any) {
      const tree = res.tree || []
      const list = res.list || []
      that.cacheTree = tree
      that.cacheList = list

      const collapsedMap = Object.assign({}, owner.data.collapsedMap)
      const sections = tree.map(function (root: SpaceTree) { return buildSection(root, collapsedMap) })

      // focusId：自动展开对应根空间并沿层级展开所有祖先及目标卡片，随后滚动定位
      const expandedMap = Object.assign({}, owner.data.expandedMap)
      if (focusId) {
        for (const s of sections) {
          if (s.id === focusId) {
            s.collapsed = false
            delete collapsedMap[s.id]
            expandedMap[s.id] = true
            break
          }
          // 在子卡片树中查找目标并展开祖先链
          const pathTo = findPathInCards(s.children, focusId)
          if (pathTo) {
            s.collapsed = false
            delete collapsedMap[s.id]
            for (const pid of pathTo) expandedMap[pid] = true
            break
          }
        }
      }

      owner.setData({
        sections: sections,
        collapsedMap: collapsedMap,
        expandedMap: expandedMap,
        loading: false,
        loaded: true
      }, function () {
        if (focusId) {
          wx.nextTick(function () {
            wx.pageScrollTo({ selector: '#space-' + focusId, duration: 300 })
          })
        }
      })

      // 对已展开的空间拉取物品列表（操作后本地重建也触发同样逻辑）
      for (const spaceId in expandedMap) {
        if (expandedMap[spaceId]) that.loadItems(spaceId)
      }
    }, function (e: any) {
      owner.setData({ loading: false, error: e.message || '加载空间失败' })
    })
  }

  // ---------- 展开 / 收起 ----------

  toggleSection(id: string): StorePatch {
    const collapsedMap = Object.assign({}, this.owner.data.collapsedMap)
    collapsedMap[id] = !collapsedMap[id]
    const sections = this.owner.data.sections.map(function (s: RootSection) {
      return s.id === id ? Object.assign({}, s, { collapsed: collapsedMap[id] }) : s
    })
    return { sections: sections, collapsedMap: collapsedMap }
  }

  toggleCard(id: string): StorePatch {
    const expandedMap = Object.assign({}, this.owner.data.expandedMap)
    const isNowExpanded = !expandedMap[id]
    expandedMap[id] = isNowExpanded
    const patch: StorePatch = { expandedMap: expandedMap }
    if (isNowExpanded && !this.owner.data.itemsMap[id]) this.loadItems(id)
    return patch
  }

  // ---------- 物品列表（per-space 懒加载，在途去重） ----------

  loadItems(spaceId: string): void {
    const owner = this.owner
    if (owner.data.loadingMap && owner.data.loadingMap[spaceId]) return
    owner.setData({ ['loadingMap.' + spaceId]: true })

    getItems({ spaceId: spaceId, page: 1, pageSize: 100 }).then(function (res: any) {
      const items: PanelItem[] = res.items.map(function (it: any) {
        const vm = mapItemCard(it)
        const parts = [it.category, vm.meta].filter(Boolean)
        return Object.assign(vm, { subtitle: parts.join(' · ') || '暂无描述' })
      })
      owner.setData({
        ['itemsMap.' + spaceId]: items,
        ['itemsCountMap.' + spaceId]: typeof res.total === 'number' ? res.total : items.length,
        ['loadingMap.' + spaceId]: false
      })
    }, function () {
      owner.setData({ ['loadingMap.' + spaceId]: false })
    })
  }

  // ---------- 本地操作：改 cacheTree + 重建 sections，不整树 fetch ----------

  /** 新建空间（任意层级）。成功后本地插入并展开父级；返回新空间 id */
  addSpace(name: string, parentId?: string | null, type?: SpaceType, icon?: string | null): Promise<string | null> {
    const that = this
    return createSpace({ name: name, parentId: parentId, type: type, icon: icon }).then(function (res: any) {
      const newId = res && res.id
      if (!newId) { that.refresh(); return null }

      const newNode: SpaceTree = {
        id: newId,
        name: name,
        itemCount: 0,
        parentId: parentId || null,
        sortOrder: 0,
        type: type || null,
        icon: icon || null,
        children: []
      }
      if (parentId) {
        const found = findNode(that.cacheTree, parentId)
        if (found) {
          if (!found.node.children) found.node.children = []
          found.node.children.push(newNode)
        } else {
          that.refresh() // 父节点本地缓存缺失（极端），回退整树刷新
          return newId
        }
      } else {
        that.cacheTree.push(newNode)
      }

      const patch = that.rebuild()
      // 展开父级（或新建的根空间自身展开），让新节点立即可见
      const targetId = parentId || newId
      const expandedMap = Object.assign({}, patch.expandedMap)
      expandedMap[targetId] = true
      const collapsedMap = Object.assign({}, patch.collapsedMap)
      delete collapsedMap[targetId]
      that.apply({ sections: patch.sections, expandedMap: expandedMap, collapsedMap: collapsedMap })
      return newId
    }, function () { return null })
  }

  /** 重命名 / 更新空间（改名 + 可换 type/icon）。成功后本地改树并重建（path 前缀随父名联动） */
  renameSpaceFull(id: string, data: { name?: string; type?: SpaceType; icon?: string | null }): Promise<void> {
    const that = this
    return updateSpace(id, data).then(function () {
      const found = findNode(that.cacheTree, id)
      if (found) {
        if (data.name !== undefined) found.node.name = data.name
        if (data.type !== undefined) found.node.type = data.type
        if (data.icon !== undefined) found.node.icon = data.icon
        that.apply(that.rebuild())
      } else {
        that.refresh()
      }
    }, function () { /* request 层已 toast */ })
  }

  /** 删除空间。成功后本地移除并清理该空间子树全部相关状态；失败保持原状（后端 400 级联保护） */
  removeSpace(id: string): Promise<void> {
    const that = this
    return deleteSpace(id).then(function () {
      // 先收集待清理 id（需在移除前完成，移除后树信息已丢）
      const dead: string[] = []
      const found = findNode(that.cacheTree, id)
      if (found) collectSubtreeIds(found.node, dead)
      removeNodeById(that.cacheTree, id)

      const patch = that.rebuild()
      if (dead.length) {
        const d = that.owner.data
        const itemsMap = Object.assign({}, d.itemsMap)
        const itemsCountMap = Object.assign({}, d.itemsCountMap)
        const loadingMap = Object.assign({}, d.loadingMap)
        const expandedMap = Object.assign({}, patch.expandedMap)
        const collapsedMap = Object.assign({}, patch.collapsedMap)
        for (const dId of dead) {
          delete itemsMap[dId]
          delete itemsCountMap[dId]
          delete loadingMap[dId]
          delete expandedMap[dId]
          delete collapsedMap[dId]
        }
        patch.itemsMap = itemsMap
        patch.itemsCountMap = itemsCountMap
        patch.loadingMap = loadingMap
        patch.expandedMap = expandedMap
        patch.collapsedMap = collapsedMap
      }
      that.apply(patch)
    }, function () { /* 400 提示由 request 层自动 toast */ })
  }

  // ---------- 内部 ----------

  /** 由 cacheTree 重建 sections，并清理已不存在节点的展开/折叠状态 */
  private rebuild(): StorePatch {
    const collapsedMap = Object.assign({}, this.owner.data.collapsedMap)
    const expandedMap = Object.assign({}, this.owner.data.expandedMap)

    const sections = this.cacheTree.map(function (root: SpaceTree) { return buildSection(root, collapsedMap) })

    for (const key of Object.keys(expandedMap)) {
      if (!findNode(this.cacheTree, key)) delete expandedMap[key]
    }
    for (const key of Object.keys(collapsedMap)) {
      if (!findNode(this.cacheTree, key)) delete collapsedMap[key]
    }
    return { sections: sections, expandedMap: expandedMap, collapsedMap: collapsedMap }
  }

  private apply(patch: StorePatch): void {
    this.owner.setData(patch)
  }

  /** 本地缓存异常时的回退：静默整树刷新（保留展开态） */
  refresh(): void {
    this.fetch(true)
  }

  // ---------- 外部只读入口（location / common-spaces 共用） ----------

  getTree(): SpaceTree[] {
    return this.cacheTree
  }

  getList(): SpaceListItem[] {
    return this.cacheList
  }
}

/** 在卡片树中查找目标 id 的祖先链（含目标自身）；找不到返回 null */
function findPathInCards(nodes: SpaceCardItem[], targetId: string): string[] | null {
  for (const n of nodes) {
    if (n.id === targetId) return [n.id]
    if (n.children && n.children.length) {
      const sub = findPathInCards(n.children, targetId)
      if (sub) return [n.id].concat(sub)
    }
  }
  return null
}