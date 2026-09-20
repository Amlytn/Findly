import { SpaceTreeStore, SpaceCardItem, RootSection, StorePatch } from '../../utils/space-tree-store'
import { SpaceType } from '../../types/api'
import type { IAppOption } from '../../app'

/** 弹层模式：add-root 新建根 / add-child 加子空间 / rename 重命名 */
type FormMode = 'add-root' | 'add-child' | 'rename'

Page({
  data: {
    sections: [] as RootSection[],
    collapsedMap: {} as Record<string, boolean>,
    expandedMap: {} as Record<string, boolean>,
    itemsMap: {} as Record<string, any[]>,
    itemsCountMap: {} as Record<string, number>,
    loadingMap: {} as Record<string, boolean>,
    loading: true,
    error: '',
    loaded: false,

    // 自定义空间设置弹层
    settingModalVisible: false,
    settingTarget: null as RootSection | SpaceCardItem | null,

    // 空间表单弹层（space-form-modal）
    formModalVisible: false,
    formModalTitle: '添加空间',
    formModalParentName: '',
    formMode: 'add-root' as FormMode,
    formTarget: null as SpaceCardItem | RootSection | null,
    formInitialName: '',
    formInitialType: '',
    formInitialIcon: ''
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
    // 从搜索结果或其他页面带着 focusSpaceId 切回时自动定位并唤起抽屉
    const app = getApp<IAppOption>()
    const focusId = app && app.globalData && app.globalData.focusSpaceId
    if (focusId) {
      app.globalData.focusSpaceId = ''
      this.store.fetch(true, focusId)
    } else if (this.data.loaded) {
      this.store.fetch(true)
    }
  },

  retry() {
    this.store.fetch()
  },

  /** 顶部轻提示 */
  onTipTap() {
    wx.showToast({ title: '建议按 房间 → 家具 → 容器 规划位置', icon: 'none', duration: 2500 })
  },

  /** 展开 / 收起根空间分组（折叠子空间卡片） */
  toggleSection(e: any) {
    const id = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || (e.target && e.target.dataset && e.target.dataset.id)
    if (!id) return
    this.apply(this.store.toggleSection(id))
  },

  /** 点击分组头部：无论有无子空间均折叠/展开当前分组 */
  tapSectionHeader(e: any) {
    const sec: RootSection = e.currentTarget.dataset.section
    if (!sec) return
    this.toggleSection({ currentTarget: { dataset: { id: sec.id } } })
  },

  /** 点击子空间卡片：独立展开/收起其内联面板 */
  tapCard(e: any) {
    const item: SpaceCardItem = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (!item) return
    this.apply(this.store.toggleCard(item.id))
  },

  onTapCard(e: any) {
    this.tapCard(e)
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
      this.openForm('rename', target)
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

  // ---------- 空间表单弹层（space-form-modal） ----------

  /** 打开表单弹层 */
  openForm(mode: FormMode, target?: SpaceCardItem | RootSection | null) {
    const base: {
      formModalVisible: boolean
      formMode: FormMode
      formTarget: SpaceCardItem | RootSection | null
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
      base.formModalTitle = '重命名空间'
      base.formInitialName = target.name
      // 预填已有 type / icon（store 节点暂未回填字段，这里从 target 上取；无则留空）
      base.formInitialType = (target as any).type || ''
      base.formInitialIcon = (target as any).icon || ''
    } else if (mode === 'add-child' && target) {
      base.formModalTitle = '添加子空间'
      base.formModalParentName = target.name
    } else {
      base.formModalTitle = '添加空间'
    }
    this.setData(base)
  },

  openAddRoot() {
    this.openForm('add-root')
  },

  onAddButtonTap() {
    this.openAddRoot()
  },

  onSectionAddChild(e: any) {
    const section: RootSection = e.currentTarget.dataset.section
    if (section) this.openForm('add-child', section)
  },

  onPanelRename(e: any) {
    const item = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (item) this.openForm('rename', item)
  },

  onPanelAddChild(e: any) {
    const item = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (item) this.openForm('add-child', item)
  },

  /** 内联面板专属操作栏：直接向当前空间内加入物品 */
  onPanelAddItem(e: any) {
    const item = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (!item) return
    const app = getApp() as any
    app.globalData.locationId = item.id
    app.globalData.locationPath = item.pathArr && item.pathArr.length ? item.pathArr : [item.name]
    wx.navigateTo({ url: '/pages/add/add' })
  },

  onPanelDelete(e: any) {
    const item = (e.detail && e.detail.item) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.item)
    if (item) this.deleteSpaceConfirm(item)
  },

  /** 表单弹层：取消 */
  onFormCancel() {
    this.setData({ formModalVisible: false })
  },

  /** 表单弹层：确认提交（按 mode 分发到 store 的本地操作） */
  onFormConfirm(e: any) {
    const detail = e.detail || {}
    const name: string = detail.name
    const type: SpaceType | undefined = detail.type
    const icon: string | null = detail.icon
    const mode = this.data.formMode
    const target = this.data.formTarget

    const finish = (ok: boolean, msg: string) => {
      this.setData({ formModalVisible: false })
      if (ok) wx.showToast({ title: msg, icon: 'success' })
    }

    if (mode === 'rename' && target) {
      // 未改动名称时直接关闭（store 的 renameSpace 内部会忽略同名）
      if (name === target.name && !type && !icon && !(target as any).type && !(target as any).icon) {
        this.setData({ formModalVisible: false })
        return
      }
      // 重命名 + 可换 type/icon：字段未提供时保持原值，icon 传 null 表示清除
      const patch: any = {}
      if (name !== target.name) patch.name = name
      if (type) patch.type = type
      if (icon === null && (target as any).icon) patch.icon = null
      else if (icon) patch.icon = icon
      this.store.renameSpaceFull(target.id, patch).then(function () {
        finish(true, '已保存')
      })
      return
    }

    // 新建（add-root / add-child）
    const parentId = mode === 'add-child' && target ? target.id : null
    this.store.addSpace(name, parentId, type, icon).then(function (newId: string | null) {
      finish(!!newId, mode === 'add-child' ? '子空间已添加' : '空间已创建')
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
          that.openForm('rename', item)
        } else if (r.tapIndex === 1) {
          that.openForm('add-child', item)
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
          that.openForm('add-child', section)
        } else if (r.tapIndex === 1) {
          that.openForm('rename', section)
        } else if (r.tapIndex === 2) {
          that.deleteSpaceConfirm(section)
        }
      }
    })
  },

  /** 删除空间（受后端 400 级联约束保护）——成功后本地移除，不整树刷新 */
  deleteSpaceConfirm(target: SpaceCardItem | RootSection) {
    const that = this
    wx.showModal({
      title: '删除空间',
      content: '确定要删除「' + target.name + '」吗？若该空间下有子空间或物品，请先移走。',
      confirmColor: '#E06B6B',
      success(res: any) {
        if (!res.confirm) return
        that.store.removeSpace(target.id).then(function () {
          wx.showToast({ title: '已删除空间', icon: 'success' })
        })
      }
    })
  },

  /** 查看物品详情 */
  goItemDetail(e: any) {
    const id = (e.detail && e.detail.id) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id)
    if (id) {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
    }
  },

  /** store 补丁统一回写入口 */
  apply(patch: StorePatch) {
    if (patch) this.setData(patch as Record<string, any>)
  }
})