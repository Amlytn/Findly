import { fullUrl, isApiError } from '../../services/request'
import { getItem, deleteItem, updateItem, getRelated } from '../../services/items'
import { getSuggestions } from '../../services/search'
import { ItemDetail } from '../../types/api'

Page({
  data: {
    id: '',
    obj: null as ItemDetail | null,
    tags: [] as string[],
    related: [] as any[],
    suggestions: [] as string[],
    loading: true,
    error: '',
    /** 编辑弹层开关 / 提交中标记 / 表单值（字段与 PATCH /items/:id 契约一一对应） */
    editing: false,
    saving: false,
    form: {
      name: '',
      category: '',
      brand: '',
      model: '',
      color: '',
      quantity: '',
      description: '',
      tags: [] as string[]
    }
  },

  onLoad(query: any) {
    this.setData({ id: query.id || '' })
    this.fetch()
  },

  fetch() {
    const that = this
    this.setData({ loading: true, error: '' })
    getItem(this.data.id).then(function (res) {
      // 展示字段映射：img 无图用 logo 占位；space=叶子空间名；zone=完整位置路径
      // previewUrl 仅在真实照片存在时可用于全屏预览（走 fullUrl 补齐完整域名协议）
      const obj = Object.assign({}, res, {
        img: fullUrl(res.imageUrl) || '/assets/logo.png',
        previewUrl: res.imageUrl ? fullUrl(res.imageUrl) : '',
        space: res.space ? res.space.name : '未归位',
        zone: res.path || ''
      })
      that.setData({ obj: obj, tags: res.tags || [], loading: false })
    }).catch(function (e: any) {
      that.setData({ loading: false, error: e.message || '加载失败' })
    })
    getRelated(this.data.id).then(function (res) {
      const related = res.items.slice(0, 4).map(function (r) {
        return Object.assign({}, r, { img: fullUrl(r.imageUrl) || '/assets/logo.png' })
      })
      that.setData({ related: related })
    }).catch(function () { /* 同类为空则隐藏 */ })
    getSuggestions().then(function (res) {
      that.setData({ suggestions: (res.suggestions || []).slice(0, 3) })
    }).catch(function () { /* 无建议词则隐藏 */ })
  },

  retry() {
    this.fetch()
  },

  goDetail(e: any) {
    wx.redirectTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  goSearch(e: any) {
    wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(e.currentTarget.dataset.kw) })
  },

  /** 点击主图全屏预览（仅真实照片；logo 占位不响应） */
  previewImg() {
    const url = (this.data as any).obj && (this.data as any).obj.previewUrl
    if (!url) return
    wx.previewImage({ urls: [url] })
  },

  /** 编辑入口：选择「编辑资料 / 移动位置」（删除在页面底部有独立按钮，不重复放这里） */
  edit() {
    const that = this
    if (!(this.data as any).obj) return
    wx.showActionSheet({
      itemList: ['编辑资料', '移动位置'],
      success(r: any) {
        if (r.tapIndex === 1) {
          that.move()
          return
        }
        that.openEdit()
      }
    })
  },

  /** 打开编辑弹层：用当前详情预填表单 */
  openEdit() {
    const o = (this.data as any).obj
    if (!o) return
    this.setData({
      editing: true,
      form: {
        name: o.name || '',
        category: o.category || '',
        brand: o.brand || '',
        model: o.model || '',
        color: o.color || '',
        quantity: o.quantity != null ? String(o.quantity) : '',
        description: o.description || '',
        tags: (o.tags || []).slice()
      }
    })
  },

  closeEdit() {
    // 保存中不允许关闭，避免请求回来时表单已被清掉
    if ((this.data as any).saving) return
    this.setData({ editing: false })
  },

  /** 弹层内所有 input/textarea 共用：靠 data-k 区分写到 form 的哪个字段 */
  onInput(e: any) {
    const k = e.currentTarget.dataset.k
    if (!k) return
    const patch: any = {}
    patch['form.' + k] = e.detail.value
    this.setData(patch)
  },

  addTag() {
    const that = this
    wx.showModal({
      title: '添加标签',
      editable: true,
      placeholderText: '如：无线、办公',
      success(res: any) {
        if (!res.confirm) return
        const t = (res.content || '').trim()
        if (!t) return
        const tags = ((that.data as any).form.tags || []).slice()
        if (tags.indexOf(t) < 0) tags.push(t)
        that.setData({ 'form.tags': tags })
      }
    })
  },

  removeTag(e: any) {
    const t = e.currentTarget.dataset.t
    const tags = ((this.data as any).form.tags || []).filter(function (x: string) { return x !== t })
    this.setData({ 'form.tags': tags })
  },

  /** 提交 PATCH：字段与 UpdateItemDto 对齐；空串转 null 表示清空该字段（契约允许 null） */
  saveEdit() {
    const f = (this.data as any).form || {}
    const name = (f.name || '').trim()
    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    const qty = parseInt(f.quantity, 10)
    if (isNaN(qty) || qty < 1) {
      wx.showToast({ title: '数量需为大于 0 的整数', icon: 'none' })
      return
    }
    if ((this.data as any).saving) return
    const that = this
    this.setData({ saving: true })
    // 标签：去空格 / 去重 / 截断 10 个（与 result 页保存规则保持一致）
    const tags = (f.tags || [])
      .map(function (t: string) { return (t || '').trim() })
      .filter(function (t: string, i: number, arr: string[]) { return t && arr.indexOf(t) === i })
      .slice(0, 10)
    const trimOrNull = function (v: string) {
      const s = (v || '').trim()
      return s ? s : null
    }
    updateItem(that.data.id, {
      name: name,
      category: (f.category || '').trim() || '未分类',
      brand: trimOrNull(f.brand),
      model: trimOrNull(f.model),
      color: trimOrNull(f.color),
      description: trimOrNull(f.description),
      quantity: qty,
      tags: tags
    }).then(function () {
      that.setData({ saving: false, editing: false })
      wx.showToast({ title: '已保存', icon: 'success' })
      // 重新拉取：详情字段、同类物品、位置路径都跟着刷新
      that.fetch()
    }).catch(function () {
      // 失败原因由 request 层统一 toast
      that.setData({ saving: false })
    })
  },

  /** 移动位置：打开树形空间选择页（支持全量空间与任意深度，解决 ActionSheet 6 项限制） */
  move() {
    const that = this
    wx.navigateTo({
      url: '/pages/location/location',
      events: {
        selectLocation(target: { id: string; name: string; path: string[] }) {
          if (!target || !target.id) return
          updateItem(that.data.id, { spaceId: target.id }).then(function () {
            wx.showToast({ title: '已移动到 ' + target.name, icon: 'success' })
            that.fetch()
          }).catch(function () { /* request 层已 toast */ })
        }
      }
    })
  },

  del() {
    const that = this
    const obj = (this.data as any).obj || {}
    wx.showModal({
      title: '删除物品',
      content: '确定删除「' + (obj.name || '') + '」吗？',
      confirmColor: '#E06B6B',
      success(res: any) {
        if (!res.confirm) return
        deleteItem(that.data.id).then(function (r) {
          // 契约：重复删除返回 404 视为成功
          if (isApiError(r) && r.statusCode !== 404) {
            wx.showToast({ title: r.message, icon: 'none' })
            return
          }
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(function () { wx.navigateBack({ delta: 1 }) }, 600)
        })
      }
    })
  }
})
