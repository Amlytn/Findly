import { fullUrl } from '../../services/request'
import { getItem, deleteItem, updateItem, getRelated } from '../../services/items'
import { getSpaces } from '../../services/spaces'
import { getSuggestions } from '../../services/search'
import { isApiError } from '../../services/request'
import { ItemDetail } from '../../types/api'

Page({
  data: {
    id: '',
    obj: null as ItemDetail | null,
    tags: [] as string[],
    related: [] as any[],
    suggestions: [] as string[],
    loading: true,
    error: ''
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
      // previewUrl 仅在真实照片存在时可用于全屏预览
      const obj = Object.assign({}, res, {
        img: fullUrl(res.imageUrl) || '/assets/logo.png',
        previewUrl: res.imageUrl || '',
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

  /** 编辑入口：选择「改名称 / 移动位置」 */
  edit() {
    const that = this
    const obj = (this.data as any).obj
    if (!obj) return
    wx.showActionSheet({
      itemList: ['改名称', '移动位置'],
      success(r: any) {
        if (r.tapIndex === 1) {
          that.move()
          return
        }
        wx.showModal({
          title: '编辑名称',
          editable: true,
          placeholderText: obj.name,
          success(res: any) {
            if (!res.confirm) return
            const name = (res.content || '').trim()
            if (!name) {
              wx.showToast({ title: '名称不能为空', icon: 'none' })
              return
            }
            updateItem(that.data.id, { name: name }).then(function () {
              wx.showToast({ title: '已保存', icon: 'success' })
              that.fetch()
            }).catch(function () { /* request 层已 toast */ })
          }
        })
      }
    })
  },

  /** 移动位置：真实空间树叶子列表 → PATCH spaceId（ActionSheet 上限 6 项） */
  move() {
    const that = this
    getSpaces().then(function (res) {
      const leaves: { id: string; name: string; path: string[] }[] = []
      const walk = function (nodes: any[], prefix: string[]) {
        for (const n of nodes) {
          const path = prefix.concat(n.name)
          if (n.children && n.children.length) {
            walk(n.children, path)
          } else {
            leaves.push({ id: n.id, name: n.name, path: path })
          }
        }
      }
      walk(res.tree || [], [])
      const items = leaves.map(function (l) { return l.path.join(' › ') })
      if (!items.length) {
        wx.showToast({ title: '暂无可选空间', icon: 'none' })
        return
      }
      wx.showActionSheet({
        itemList: items.slice(0, 6),
        success(r: any) {
          const target = leaves[r.tapIndex]
          updateItem(that.data.id, { spaceId: target.id }).then(function () {
            wx.showToast({ title: '已移动到' + target.name, icon: 'success' })
            that.fetch()
          }).catch(function () { /* request 层已 toast */ })
        }
      })
    }).catch(function () { /* request 层已 toast */ })
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
