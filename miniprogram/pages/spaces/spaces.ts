import { SpaceTreeStore, SpaceCardItem, StorePatch, MovableTarget } from '../../utils/space-tree-store'
import { SpaceType } from '../../types/api'
import type { IAppOption } from '../../app'

/** 弹层模式：add-root 新建根 / add-child 加子空间 / rename 编辑空间 */
type FormMode = 'add-root' | 'add-child' | 'rename'

/** 拖拽状态：dragId 被拖节点；parentId 所在同级容器（null=根列表）；index 插入位（0 基，含末尾） */
interface DragState {
  dragId: string
  parentId: string | null
  index: number
}

Page({
  data: {
    // 视图模型（store 回写）：根空间卡片流，逐层就地展开（space-node 递归渲染）
    sections: [] as SpaceCardItem[],
    itemsMap: {} as Record<string, any[]>,
    itemsCountMap: {} as Record<string, number>,
    loadingMap: {} as Record<string, boolean>,
    loading: true,
    error: '',
    loaded: false,

    // 同级拖动排序
    drag: null as DragState | null,
    ghostShow: false,
    ghostY: 0,
    ghostIcon: '',
    ghostName: '',
    ghostTotal: 0,

    // 搜索回跳高亮 / 新建获焦
    highlightId: '',
    focusId: '',

    // 空间管理菜单（S4 收敛入口：编辑 / 移动到 / 删除）
    actionSheetVisible: false,
    actionTarget: null as SpaceCardItem | null,
    actionCanDelete: false,

    // 移动空间目标选择弹层
    moveModalVisible: false,
    moveTargets: [] as MovableTarget[],

    // 空间表单弹层（space-form-modal）
    formModalVisible: false,
    formModalTitle: '添加空间',
    formModalParentName: '',
    formMode: 'add-root' as FormMode,
    formTarget: null as SpaceCardItem | null,
    formInitialName: '',
    formInitialType: '',
    formInitialIcon: ''
  },

  /** 空间树状态权威源；onLoad 里实例化（声明在此只为让 this 有这个成员的形状） */
  store: null as unknown as SpaceTreeStore,

  /** 页面滚动位置（拖动步进计算用） */
  _scrollTop: 0,
  /** 本次拖拽会话：被拖节点、同级 id 序列、自身下标、起始触点、单行步进（px） */
  _drag: null as null | {
    item: SpaceCardItem
    sibIds: string[]
    selfIdx: number
    startPageY: number
    step: number
    targetIdx: number
  },

  onLoad() {
    this.store = new SpaceTreeStore(this)
    this.store.fetch()
  },

  onShow() {
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 2 })
    }
    // 搜索/详情回跳：展开祖先链定位空间，物品高亮交给 space-node 的 highlightId 观察器
    const app = getApp<IAppOption>()
    const focusId = app && app.globalData && app.globalData.focusSpaceId
    const focusItemId = app && app.globalData && app.globalData.focusItemId
    if (focusId || focusItemId) {
      if (app && app.globalData) {
        app.globalData.focusSpaceId = ''
        app.globalData.focusItemId = ''
      }
      const that = this
      this.setData({ highlightId: '' })
      this.store.fetch(true, focusId || undefined).then(function () {
        if (focusItemId) {
          // 等物品懒加载落地后再点亮（组件观察器负责滚动入视口）
          setTimeout(function () {
            that.setData({ highlightId: focusItemId })
            setTimeout(function () {
              that.setData({ highlightId: '' })
            }, 3200)
          }, 400)
        }
      })
    } else if (this.data.loaded) {
      this.store.fetch(true)
    }
    // 兜底：从其它页面返回时若弹层均已关闭，确保 tab 栏恢复显示
    this.syncTabBar()
  },

  onPageScroll(e: any) {
    this._scrollTop = (e && e.scrollTop) || 0
  },

  retry() {
    this.store.fetch()
  },

  /** 顶部规划提示通栏 */
  onTipTap() {
    wx.showToast({ title: '建议按 房间 → 家具 → 容器 规划位置', icon: 'none', duration: 2500 })
  },

  /**
   * 任一弹层打开时隐藏底部 tab 栏：自定义 tab 栏（custom: true）由框架绘制、盖在弹层
   * z-index(999) 之上且对 wx.hideTabBar 免疫，必须 getTabBar().setData({hidden}) 自藏；
   * hideTabBar 一并调用兜底非自定义形态。全部关闭后恢复。
   */
  syncTabBar() {
    const open = this.data.actionSheetVisible || this.data.moveModalVisible || this.data.formModalVisible
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ hidden: open })
    }
    if (open) {
      wx.hideTabBar({ animation: false, fail: function () { /* 非 tab 页或已隐藏时忽略 */ } })
    } else {
      wx.showTabBar({ animation: false, fail: function () { /* 同上 */ } })
    }
  },

  // ---------- space-node 上抛事件（bubbles+composed，统一在此收口） ----------

  /** 点卡片/行：就地展开/收起（逐节点独立） */
  onNodeToggle(e: any) {
    const item: SpaceCardItem = e.detail && e.detail.item
    if (!item) return
    this.store.toggle(item.id)
  },

  /** 「⋯」：空间管理菜单 */
  onNodeMore(e: any) {
    const item: SpaceCardItem = e.detail && e.detail.item
    if (item) this.openActionSheet(item)
  },

  /** 物品模块「＋ 添加物品」/ 空态点按：当前空间作为默认存放位置 */
  onNodeAddItem(e: any) {
    const item: SpaceCardItem = e.detail && e.detail.item
    if (!item) return
    const app = getApp() as any
    app.globalData.locationId = item.id
    app.globalData.locationPath = item.pathArr && item.pathArr.length ? item.pathArr : [item.name]
    wx.navigateTo({ url: '/pages/add/add' })
  },

  /** 空间模块「＋ 添加空间」/ 空态点按：默认建为当前空间直属子空间 */
  onNodeAddSpace(e: any) {
    const item: SpaceCardItem = e.detail && e.detail.item
    if (item) this.openForm('add-child', item)
  },

  /** 货架缩略瓦片：物品详情 */
  goItemDetail(e: any) {
    const id = e.detail && e.detail.id
    if (id) {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
    }
  },

  /** 货架「···」：进入该空间完整物品列表 */
  onNodeShowAll(e: any) {
    const item: SpaceCardItem = e.detail && e.detail.item
    if (!item) return
    wx.navigateTo({
      url: '/pages/items/items?spaceId=' + item.id + '&spaceName=' + encodeURIComponent(item.name)
    })
  },

  // ---------- 同级拖动排序（长按进入，松手落位） ----------

  onNodeDragStart(e: any) {
    const detail = e.detail || {}
    const item: SpaceCardItem = detail.item
    if (!item || this._drag) return
    const sibIds = this.store.getSiblingIds(item.id)
    if (sibIds.length < 2) {
      wx.showToast({ title: '同级只有一个空间，无需排序', icon: 'none' })
      return
    }
    const selfIdx = sibIds.indexOf(item.id)
    if (selfIdx === -1) return
    this._drag = {
      item: item,
      sibIds: sibIds,
      selfIdx: selfIdx,
      startPageY: 0,
      step: Math.max(40, (detail.height || 60) + 4),
      targetIdx: selfIdx
    }
    this.setData({
      drag: { dragId: item.id, parentId: item.parentId, index: selfIdx },
      ghostShow: true,
      ghostY: detail.top || 0,
      ghostIcon: item.cardIcon,
      ghostName: item.name,
      ghostTotal: item.total
    })
  },

  onNodeDragMove(e: any) {
    const d = this._drag
    if (!d) return
    const detail = e.detail || {}
    const pageY = detail.pageY
    const clientY = detail.clientY
    if (typeof pageY !== 'number') return
    if (!d.startPageY) d.startPageY = pageY
    const shift = Math.round((pageY - d.startPageY) / d.step)
    let target = d.selfIdx + shift
    if (target < 0) target = 0
    if (target > d.sibIds.length - 1) target = d.sibIds.length - 1
    d.targetIdx = target
    // 插入线位置（同级 gap 序列）：落在自身之后时索引 +1
    const gapIndex = target > d.selfIdx ? target + 1 : target
    this.setData({
      drag: { dragId: d.item.id, parentId: d.item.parentId, index: gapIndex },
      ghostY: clientY || d.startPageY - this._scrollTop
    })
  },

  onNodeDragEnd() {
    const d = this._drag
    this._drag = null
    this.setData({ drag: null, ghostShow: false })
    if (!d) return
    if (d.targetIdx !== d.selfIdx) {
      this.store.reorderTo(d.item.id, d.targetIdx)
    }
  },

  // ---------- 空间管理菜单（编辑 / 移动到 / 删除） ----------

  openActionSheet(target: SpaceCardItem) {
    if (!target) return
    this.setData({
      actionSheetVisible: true,
      actionTarget: target,
      actionCanDelete: this.store.isEmptyNode(target.id)
    })
    this.syncTabBar()
  },

  closeActionSheet() {
    this.setData({ actionSheetVisible: false })
    this.syncTabBar()
  },

  preventBubble() {
    // 阻止点击弹层卡片冒泡到遮罩关闭
  },

  preventTouchMove() {
    // 阻止底层滑动穿透
  },

  /** 菜单操作：编辑空间（名称 + 图标） */
  onActionEdit() {
    const target = this.data.actionTarget
    this.closeActionSheet()
    if (target) {
      this.openForm('rename', target)
    }
  },

  /** 菜单操作：移动到…（空间选择器，防成环） */
  onActionMove() {
    const target = this.data.actionTarget
    this.closeActionSheet()
    if (!target) return
    const targets = this.store.getMovableTargets(target.id)
    this.setData({
      moveModalVisible: true,
      moveTargets: targets
    })
    this.syncTabBar()
  },

  closeMoveModal() {
    this.setData({ moveModalVisible: false })
    this.syncTabBar()
  },

  /** 选择移动目标 */
  onSelectMoveTarget(e: any) {
    const target: MovableTarget = e.currentTarget.dataset.target
    if (!target || target.disabled || target.isCurrentParent) return
    const actionTarget = this.data.actionTarget
    if (!actionTarget) return

    const that = this
    this.setData({ moveModalVisible: false })
    this.syncTabBar()
    this.store.moveSpace(actionTarget.id, target.id).then(function (ok: boolean) {
      if (ok) {
        wx.showToast({
          title: target.id ? '已移至「' + target.name + '」' : '已设为顶级空间',
          icon: 'success'
        })
      }
    })
  },

  /** 菜单操作：删除空间（仅完全为空可删，不提供强制级联） */
  onActionDelete() {
    const target = this.data.actionTarget
    if (!target) return
    if (!this.data.actionCanDelete) {
      wx.showToast({ title: '存在子空间或物品，请先清空或移动内容', icon: 'none', duration: 2500 })
      return
    }
    this.closeActionSheet()
    this.deleteSpaceConfirm(target)
  },

  // ---------- 空间表单弹层（space-form-modal） ----------

  /** 打开表单弹层 */
  openForm(mode: FormMode, target?: SpaceCardItem | null) {
    const base: {
      formModalVisible: boolean
      formMode: FormMode
      formTarget: SpaceCardItem | null
      formModalTitle: string
      formInitialName: string
      formInitialType: string
      formInitialIcon: string
      formModalParentName: string
    } = {
      formModalVisible: true,
      formMode: mode,
      formTarget: target || null,
      formModalTitle: '添加空间',
      formInitialName: '',
      formInitialType: '',
      formInitialIcon: '',
      formModalParentName: ''
    }
    if (mode === 'rename' && target) {
      base.formModalTitle = '编辑空间'
      base.formInitialName = target.name
      base.formInitialType = target.type || ''
      base.formInitialIcon = target.icon || ''
    } else if (mode === 'add-child' && target) {
      base.formModalTitle = '添加子空间'
      base.formModalParentName = target.name
    } else {
      base.formModalTitle = '添加空间'
    }
    this.setData(base)
    this.syncTabBar()
  },

  /** 底部主按钮：新建根空间 */
  onAddButtonTap() {
    this.openForm('add-root')
  },

  /** 表单弹层：取消 */
  onFormCancel() {
    this.setData({ formModalVisible: false })
    this.syncTabBar()
  },

  /** 表单弹层：确认提交（按 mode 分发到 store 的本地操作，局部更新不刷整页） */
  onFormConfirm(e: any) {
    const detail = e.detail || {}
    const name: string = detail.name
    const type: SpaceType | undefined = detail.type
    const icon: string | null = detail.icon
    const mode = this.data.formMode
    const target = this.data.formTarget

    const finish = (ok: boolean, msg: string) => {
      this.setData({ formModalVisible: false })
      this.syncTabBar()
      if (ok) wx.showToast({ title: msg, icon: 'success' })
    }

    if (mode === 'rename' && target) {
      // 未改动名称时直接关闭（store 的 renameSpaceFull 内部会忽略同名）
      if (name === target.name && !type && !icon && !target.type && !target.icon) {
        this.setData({ formModalVisible: false })
        this.syncTabBar()
        return
      }
      // 编辑：改名 + 换 type/icon，路径与统计随本地重建联动更新
      const patch: any = {}
      if (name !== target.name) patch.name = name
      if (type) patch.type = type
      if (icon === null && target.icon) patch.icon = null
      else if (icon) patch.icon = icon
      this.store.renameSpaceFull(target.id, patch).then(function () {
        finish(true, '已保存')
      })
      return
    }

    // 新建（add-root / add-child）：成功后新空间自动获焦（滚动到位），其它展开状态不动
    const that = this
    const parentId = mode === 'add-child' && target ? target.id : null
    this.store.addSpace(name, parentId, type, icon).then(function (newId: string | null) {
      finish(!!newId, mode === 'add-child' ? '子空间已添加' : '空间已创建')
      if (newId) {
        if (!parentId) {
          // 新根空间在页面模板里，直接滚动获焦并展开
          that.store.expand(newId)
          setTimeout(function () {
            wx.pageScrollTo({ selector: '#space-' + newId, duration: 300 })
          }, 150)
        } else {
          // 新子空间在组件模板里，focusId 下发给 space-node 观察器处理
          that.setData({ focusId: '' })
          setTimeout(function () {
            that.setData({ focusId: newId })
            setTimeout(function () {
              that.setData({ focusId: '' })
            }, 1200)
          }, 150)
        }
      }
    })
  },

  /** 删除空间（仅完全为空时可走到这里；后端 400 级联保护兜底） */
  deleteSpaceConfirm(target: SpaceCardItem) {
    const that = this
    wx.showModal({
      title: '删除空间',
      content: '确定要删除「' + target.name + '」吗？',
      confirmColor: '#E06B6B',
      success(res: any) {
        if (!res.confirm) return
        that.store.removeSpace(target.id).then(function () {
          wx.showToast({ title: '已删除空间', icon: 'success' })
        })
      }
    })
  },

  /** store 补丁统一回写入口 */
  apply(patch: StorePatch) {
    if (patch) this.setData(patch as Record<string, any>)
  }
})
