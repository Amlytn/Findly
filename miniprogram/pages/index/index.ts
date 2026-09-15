import { getItems } from '../../services/items'
import { getSpaces } from '../../services/spaces'
import { ItemListItem, SpaceTree } from '../../types/api'

/** 子树物品合计（首页空间卡片展示用） */
function subtreeCount(node: SpaceTree): number {
  let sum = node.itemCount || 0
  for (const c of node.children || []) sum += subtreeCount(c)
  return sum
}

const THEMES = ['green', 'blue', 'orange', 'purple']
const ICONS = ['house', 'book', 'sofa', 'bed']

Page({
  data: {
    recentItems: [] as (ItemListItem & { img: string })[],
    spaces: [] as { id: string; name: string; zones: number; count: number; theme: string; icon: string }[]
  },

  onShow() {
    // 同步自定义 tabBar 的选中态
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 0 })
    }
    // 每次回首页刷新（保存物品后回到首页即可看到），失败静默不打扰
    this.fetch()
  },

  fetch() {
    const that = this
    getItems({ page: 1, pageSize: 3 }).then(function (res) {
      const recentItems = res.items.map(function (it: ItemListItem) {
        // seed/真实物品暂无图，用 logo 占位；M4 上传图片后即显示真图
        return Object.assign({}, it, { img: it.imageUrl || '/assets/logo.png' })
      })
      that.setData({ recentItems: recentItems })
    }).catch(function () { /* 后端未启动时首页保持空白，不阻塞浏览 */ })

    getSpaces().then(function (res) {
      const spaces = (res.tree || []).slice(0, 4).map(function (s: SpaceTree, i: number) {
        return {
          id: s.id,
          name: s.name,
          zones: (s.children || []).length,
          count: subtreeCount(s),
          theme: THEMES[i % THEMES.length],
          icon: ICONS[i % ICONS.length]
        }
      })
      that.setData({ spaces: spaces })
    }).catch(function () { /* 同上 */ })
  },

  onScan() {
    wx.showToast({ title: '扫一扫（待接入）', icon: 'none' })
  },

  onSearch(e: any) {
    const kw = (e.detail.value || '').trim()
    if (kw) {
      wx.navigateTo({ url: '/pages/results/results?kw=' + encodeURIComponent(kw) })
    }
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  onHeroTap() {
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  onItemTap(e: any) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  onSpaceTap() {
    wx.switchTab({ url: '/pages/spaces/spaces' })
  }
})
