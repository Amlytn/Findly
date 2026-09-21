import { getItem } from '../../services/items'
import { isApiError } from '../../services/request'
import { getFavoriteIds, removeFavorite } from '../../utils/favorites'
import { ItemCardVM, fallbackImg, mapItemCard } from '../../utils/item-vm'

Page({
  data: {
    loading: true,
    empty: false,
    /** 请求失败态：与"真的没有收藏"严格区分（PRD 6.4），点击整块重试 */
    error: '',
    /** 历史字段：按 id 精确拉取后不再存在截断，恒为 false（wxml 提示保留兼容） */
    truncated: false,
    items: [] as ItemCardVM[],
    totalFav: 0
  },

  onShow() {
    this.loadFavorites()
  },

  loadFavorites() {
    const that = this
    const favIds = getFavoriteIds()
    if (!favIds || favIds.length === 0) {
      this.setData({
        loading: false,
        empty: true,
        error: '',
        truncated: false,
        items: [],
        totalFav: 0
      })
      return
    }

    this.setData({ loading: true, error: '' })
    // 按收藏 id 逐个精确拉取（silent 防失效 id 弹 toast 轰炸），保持收藏先后顺序。
    // 旧实现「拉最近 100 件求交集」会让早于 100 条的收藏凭空消失，已废弃。
    Promise.all(
      favIds.map(function (id) {
        // silent 模式：失败不 reject 而是 resolve 出 {__error, statusCode}，用 isApiError 判别
        return getItem(id, true).then(function (res) {
          if (isApiError(res)) {
            // 404 = 物品已被删除 → 顺带清理该收藏记录；网络错误保留记录，下次回来重试
            return { id: id, item: null, gone: res.statusCode === 404 }
          }
          return { id: id, item: res, gone: false }
        })
      })
    ).then(function (results) {
      const matched: ItemCardVM[] = []
      for (const r of results) {
        if (r.item) {
          matched.push(mapItemCard(r.item as any))
        } else if (r.gone) {
          removeFavorite(r.id)
        }
      }
      that.setData({
        loading: false,
        items: matched,
        empty: matched.length === 0,
        totalFav: matched.length,
        error: '',
        truncated: false
      })
    }).catch(function () {
      that.setData({
        loading: false,
        error: '收藏加载失败，点击重试',
        empty: false,
        items: [],
        totalFav: 0
      })
      })
  },

  /** 图片加载失败兜底：替换该条的展示图（fallbackImg 内留 console 痕，不静默掩盖） */
  onImgError(e: any) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({ items: fallbackImg(this.data.items, idx) })
  },

  onItemTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  onUnfavorite(e: any) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '该物品'
    const that = this
    if (!id) return

    wx.showModal({
      title: '取消收藏',
      content: '确定取消收藏「' + name + '」吗？',
      confirmColor: '#E06B6B',
      success(res) {
        if (!res.confirm) return
        removeFavorite(id)
        wx.showToast({ title: '已取消收藏', icon: 'none' })
        that.loadFavorites()
      }
    })
  },

  /** 空态主按钮：全屋清单是非 tab 页（navigateTo 可返回），看完点星标回来即入收藏 */
  goShelf() {
    wx.navigateTo({ url: '/pages/common-spaces/common-spaces' })
  },

  /** 空态次按钮：收藏的前提是物品存在，先去登记 */
  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' })
  }
})
