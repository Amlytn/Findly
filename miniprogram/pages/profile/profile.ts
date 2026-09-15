import { PROFILE_KEY, DEFAULT_ID } from '../../utils/data'

Page({
  data: {
    id: DEFAULT_ID,
    avatar: ''
  },

  /** 点击头像 → 个人资料编辑 */
  goProfileEdit() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  goItems() {
    wx.switchTab({ url: '/pages/items/items' })
  },

  goSpaces() {
    wx.switchTab({ url: '/pages/spaces/spaces' })
  },

  goFamily() {
    wx.showToast({ title: '家庭功能敬请期待', icon: 'none' })
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onShow() {
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 3 })
    }
    // 资料编辑页保存后返回，这里刷新头像与 ID
    const profile = wx.getStorageSync(PROFILE_KEY) || {}
    this.setData({
      id: profile.id || DEFAULT_ID,
      avatar: profile.avatar || ''
    })
  }
})
