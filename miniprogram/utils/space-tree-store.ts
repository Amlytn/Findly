/**
 * 空间树状态 store —— 空间管理页（spaces）的树 / 展开 / 物品状态的唯一权威源。
 *
 * 空间管理 2.0 视图模型（全页内联递归展开）：
 * - 根空间卡片流；点卡片或子空间行 = 就地展开/收起（内联递归，逐层展开，不跳页）；
 * - 展开状态逐节点独立（expandedMap）：同时可展开多个空间，收起只影响自己及其内部；
 * - 计数：卡片头与子空间行 = 当前空间 + 全部下属空间的物品总数（total）；
 *   物品模块 = 直属存放物品（directCount），默认展示前 4 个，超出显示 ··· 进完整列表；
 * - 排序：长按拖动同级重排（reorderTo），本地即时生效 + 异步写回 sortOrder；
 * - 图标：统一 resolveSpaceIcon（Space.icon 字段优先，无 icon 时名称/类型匹配兜底）；
 * - 所有操作只做「本地树变更 + rebuild」，不整树 fetch、不改变其它展开状态与滚动位置；
 *   整树请求只发生在：首次进入、focusId 定位、显式 refresh（下拉刷新 / 回退兜底）。
 */
import { getSpaces, createSpace, updateSpace, deleteSpace } from '../services/spaces'
import { getItems } from '../services/items'
import { SpaceTree, SpaceListItem, SpaceType } from '../types/api'
import { resolveSpaceIcon } from './spaces'
import { ItemCardVM, mapItemCard } from './item-vm'
import { joinPath } from './space-path'

/** 空间节点视图模型（根卡片与子空间行同构，space-node 组件递归消费） */
export interface SpaceCardItem {
  id: string
  name: string
  parentId: string | null
  /** 子树总数（当前空间 + 全部下属空间的物品数） */
  total: number
  /** 直属物品数 */
  directCount: number
  pathText: string
  /** 祖先路径数组（含自身）：跨页传参用，避免再切 pathText 字符串 */
  pathArr: string[]
  cardIcon: string
  glyphIcon: string
  depth: number
  hasChildren: boolean
  /** 该节点自身是否展开（逐节点独立，收起只影响自己及内部） */
  expanded: boolean
  type?: SpaceType | null
  icon?: string | null
  children: SpaceCardItem[]
}

/** 面板内物品行（复用列表卡片 VM + 副标题） */
export interface PanelItem extends ItemCardVM {
  subtitle: string
}

/** 空间移动候选目标 */
export interface MovableTarget {
  id: string | null
  name: string
  depth: number
  disabled: boolean
  isCurrentParent: boolean
}

/** 可 setData 的补丁（页面 data 的子集） */
export interface StorePatch {
  sections?: SpaceCardItem[]
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

/** 构建节点视图；expandedMap = 各节点展开状态 */
function buildCardNode(node: SpaceTree, depth: number, prefix: string[], expandedMap: Record<string, boolean>): SpaceCardItem {
  const currentPath = prefix.concat(node.name)
  const icons = resolveSpaceIcon(node.icon, node.name, node.type)
  const children = (node.children && node.children.length)
    ? node.children.map(function (c) { return buildCardNode(c, depth + 1, currentPath, expandedMap) })
    : []
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
    hasChildren: children.length > 0,
    expanded: !!expandedMap[node.id],
    type: node.type || null,
    icon: node.icon || null,
    children: children
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
  /** 后端原始树缓存 —— 本地操作直接改它再重建视图 */
  private cacheTree: SpaceTree[] = []
  private cacheList: SpaceListItem[] = []
  /** 逐节点展开状态（收起只影响自己及内部） */
  private expandedMap: Record<string, boolean> = {}

  constructor(owner: Owner) {
    this.owner = owner
  }

  // ---------- 全量拉取（首次 / 刷新 / focusId 定位） ----------

  fetch(silent?: boolean, focusId?: string): Promise<void> {
    const that = this
    const owner = this.owner
    if (!silent) owner.setData({ loading: true, error: '' })

    return getSpaces().then(function (res: any) {
      that.cacheTree = res.tree || []
      that.cacheList = res.list || []

      // focusId：展开目标及其全部祖先，随后滚动定位
      if (focusId) {
        const chain = that.ancestorChain(focusId)
        for (const n of chain) that.expandedMap[n.id] = true
      }

      owner.setData(that.rebuild({ loading: false, loaded: true }), function () {
        if (focusId) {
          wx.nextTick(function () {
            wx.pageScrollTo({ selector: '#space-' + focusId, duration: 300 })
          })
        }
      })

      // 展开中各层物品的懒加载
      for (const sid of that.expandedIds()) that.loadItems(sid)
    }, function (e: any) {
      owner.setData({ loading: false, error: e.message || '加载空间失败' })
    })
  }

  // ---------- 展开 / 收起（逐节点独立） ----------

  /** 点卡片/行：就地展开或收起，只影响自己 */
  toggle(id: string): void {
    const map = Object.assign({}, this.expandedMap)
    const opening = !map[id]
    if (opening) map[id] = true
    else delete map[id]
    this.expandedMap = map
    if (opening) this.loadItems(id)
    this.apply(this.rebuild())
  }

  /** 展开某节点（不改变其它节点状态） */
  expand(id: string): void {
    const map = Object.assign({}, this.expandedMap)
    map[id] = true
    this.expandedMap = map
    this.loadItems(id)
    this.apply(this.rebuild())
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

  // ---------- 本地操作：改 cacheTree + 重建视图，不整树 fetch ----------

  /** 新建空间。成功后本地插入：父空间保持展开、新空间可见；返回新空间 id（页面据此滚动获焦） */
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
        // 父空间保持展开（新子空间出现在其内部）；若父在收起状态则顺带展开父以可见
        that.expandedMap = Object.assign({}, that.expandedMap, (function () {
          const m: Record<string, boolean> = {}
          m[parentId] = true
          return m
        })())
      } else {
        that.cacheTree.push(newNode)
      }
      that.apply(that.rebuild())
      return newId
    }, function () { return null })
  }

  /** 重命名 / 更新空间（改名 + 可换 type/icon）。成功后本地改树并重建（路径前缀随父名联动） */
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

  /** 删除空间（仅完全为空时后端会成功）。成功后本地移除并清理该子树状态；失败保持原状 */
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
        const expandedMap = Object.assign({}, that.expandedMap)
        for (const dId of dead) {
          delete itemsMap[dId]
          delete itemsCountMap[dId]
          delete loadingMap[dId]
          delete expandedMap[dId]
        }
        patch.itemsMap = itemsMap
        patch.itemsCountMap = itemsCountMap
        patch.loadingMap = loadingMap
      }
      that.apply(patch)
    }, function () { /* 400 提示由 request 层自动 toast */ })
  }

  /**
   * 移动空间：将目标空间移动到 targetParentId 下（null 代表变为顶级根空间）。
   * 本地即时调整内存树并重建视图；失败保持原状。
   */
  moveSpace(id: string, targetParentId: string | null): Promise<boolean> {
    const that = this
    return updateSpace(id, { parentId: targetParentId }).then(function () {
      const found = findNode(that.cacheTree, id)
      if (!found) {
        that.refresh()
        return true
      }
      const nodeToMove = found.node
      removeNodeById(that.cacheTree, id)

      nodeToMove.parentId = targetParentId
      if (targetParentId) {
        const targetParent = findNode(that.cacheTree, targetParentId)
        if (targetParent) {
          if (!targetParent.node.children) targetParent.node.children = []
          const siblings = targetParent.node.children
          const lastSort = siblings.length > 0 ? (siblings[siblings.length - 1].sortOrder || 0) : 0
          nodeToMove.sortOrder = lastSort + 10
          siblings.push(nodeToMove)
        } else {
          that.refresh()
          return true
        }
      } else {
        const lastSort = that.cacheTree.length > 0 ? (that.cacheTree[that.cacheTree.length - 1].sortOrder || 0) : 0
        nodeToMove.sortOrder = lastSort + 10
        that.cacheTree.push(nodeToMove)
      }

      // 目标父级若收起，顺带展开以露出被移入的空间；其它节点展开状态不变
      if (targetParentId && !that.expandedMap[targetParentId]) {
        that.expandedMap = Object.assign({}, that.expandedMap, (function () {
          const m: Record<string, boolean> = {}
          m[targetParentId] = true
          return m
        })())
      }
      that.apply(that.rebuild())
      that.loadItems(id)
      return true
    }, function () {
      return false
    })
  }

  /**
   * 同级拖动排序：将 id 移动到其同级列表的 targetIndex 处（0 基）。
   * 内存树即时生效并规范化 sortOrder（step 10），后台异步写回；写回失败静默刷新兜底。
   */
  reorderTo(id: string, targetIndex: number): Promise<boolean> {
    const that = this
    const found = findNode(this.cacheTree, id)
    if (!found) return Promise.resolve(false)
    const siblings = found.parent
    const idx = siblings.findIndex(function (s) { return s.id === id })
    if (idx === -1) return Promise.resolve(false)

    let to = targetIndex
    if (to < 0) to = 0
    if (to > siblings.length - 1) to = siblings.length - 1
    if (to === idx) return Promise.resolve(true)

    // 1. 数组内移动（先摘出再插入，targetIndex 为「不含自身」序列中的落点）
    const [node] = siblings.splice(idx, 1)
    siblings.splice(to, 0, node)

    // 2. 规范化同级 sortOrder (step 10)，收集需要写回的节点
    const toUpdate: { id: string; sortOrder: number }[] = []
    siblings.forEach(function (n, index) {
      const targetSort = index * 10
      if (n.sortOrder !== targetSort) {
        n.sortOrder = targetSort
        toUpdate.push({ id: n.id, sortOrder: targetSort })
      }
    })

    // 3. 本地即时生效（视觉位置立即更新）
    that.apply(that.rebuild())

    // 4. 后台异步保存
    if (!toUpdate.length) return Promise.resolve(true)
    return Promise.all(
      toUpdate.map(function (item) {
        return updateSpace(item.id, { sortOrder: item.sortOrder })
      })
    ).then(function () {
      return true
    }).catch(function () {
      that.refresh()
      return false
    })
  }

  /**
   * 获取指定空间可移动的目标空间列表（排除自身及所有子代，防止成环）
   */
  getMovableTargets(excludeId: string): MovableTarget[] {
    const found = findNode(this.cacheTree, excludeId)
    const currentParentId = found ? found.node.parentId : null

    // 收集自身及所有后代 ID
    const dead: string[] = []
    if (found) collectSubtreeIds(found.node, dead)

    const list: MovableTarget[] = [
      {
        id: null,
        name: '设为顶级空间（根空间）',
        depth: 0,
        disabled: currentParentId === null,
        isCurrentParent: currentParentId === null
      }
    ]

    function walk(nodes: SpaceTree[], depth: number) {
      for (const node of nodes) {
        const isSelfOrDescendant = dead.indexOf(node.id) !== -1
        const isCurrentParent = node.id === currentParentId
        list.push({
          id: node.id,
          name: node.name,
          depth: depth,
          disabled: isSelfOrDescendant || isCurrentParent,
          isCurrentParent: isCurrentParent
        })
        if (node.children && node.children.length) {
          walk(node.children, depth + 1)
        }
      }
    }

    walk(this.cacheTree, 1)
    return list
  }

  /** 某节点的兄弟 id 列表（含自身，按显示序）；拖动排序取插入位用 */
  getSiblingIds(id: string): string[] {
    const found = findNode(this.cacheTree, id)
    if (!found) return []
    return found.parent.map(function (n) { return n.id })
  }

  /** 节点是否完全为空（无子空间且无物品，含后代）——删除前置校验 */
  isEmptyNode(id: string): boolean {
    const found = findNode(this.cacheTree, id)
    if (!found) return false
    return subtreeTotal(found.node) === 0 && !(found.node.children && found.node.children.length)
  }

  // ---------- 内部 ----------

  /** 自根到目标 id 的祖先链（含自身）；id 不存在返回空数组 */
  private ancestorChain(id: string): SpaceTree[] {
    const chain: SpaceTree[] = []
    let found = findNode(this.cacheTree, id)
    let guard = 0
    while (found && guard < 50) {
      chain.unshift(found.node)
      const pid = found.node.parentId
      found = pid ? findNode(this.cacheTree, pid) : null
      guard++
    }
    if (guard >= 50) return []
    return chain[0] && !chain[0].parentId ? chain : []
  }

  /** 当前展开中的全部节点 id */
  private expandedIds(): string[] {
    return Object.keys(this.expandedMap)
  }

  /** 由 cacheTree 重建当前视图，并清理已不存在的展开标记 */
  private rebuild(extra?: StorePatch): StorePatch {
    const that = this
    const patch: StorePatch = Object.assign({}, extra || {})

    for (const key of Object.keys(that.expandedMap)) {
      if (!findNode(that.cacheTree, key)) delete that.expandedMap[key]
    }

    patch.sections = that.cacheTree.map(function (root: SpaceTree) {
      return buildCardNode(root, 0, [], that.expandedMap)
    })
    return patch
  }

  private apply(patch: StorePatch): void {
    this.owner.setData(patch)
  }

  /** 本地缓存异常时的回退：静默整树刷新（保留展开状态） */
  refresh(): void {
    this.fetch(true)
  }

  // ---------- 外部只读入口 ----------

  getTree(): SpaceTree[] {
    return this.cacheTree
  }

  getList(): SpaceListItem[] {
    return this.cacheList
  }
}
