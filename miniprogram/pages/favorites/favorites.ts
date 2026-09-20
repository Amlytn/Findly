import { getItems } from '../../services/items'
import { getFavoriteIds, removeFavorite } from '../../utils/favorites'
import { ItemListItem } from '../../types/api'
import { ItemCardVM, fallbackImg, mapItemCard } from '../../utils/item-vm'

Page({
  data: {
    loading: true,
    empty: false,
    /** 请求失败态：与"真的没有收藏"严格区分（PRD 6.4），点击整块重试 */
    error: '',
    /** 收藏 id 数超过一次拉取范围（pageSize 100）时提示未全部显示 */
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
    // 一次拉取最近 100 件物品，并按收藏 id 交集渲染（保持收藏先后顺序，展示最新数据）
    getItems({ page: 1, pageSize: 100 })
      .then(function (res) {
        const itemMap = new Map<string, ItemListItem>()
        for (const it of res.items) {
          itemMap.set(it.id, it)
        }

        const matched: ItemCardVM[] = []
        for (const id of favIds) {
          const it = itemMap.get(id)
          if (it) {
            matched.push(mapItemCard(it))
          }
        }

        that.setData({
          loading: false,
          items: matched,
          empty: matched.length === 0,
          totalFav: matched.length,
          error: '',
          truncated: favIds.length > matched.length
        })
      })
      .catch(function () {
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
