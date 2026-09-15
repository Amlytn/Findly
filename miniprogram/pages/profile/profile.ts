import { getMe } from '../../services/users'
import { DEFAULT_ID, loadProfile } from '../../utils/profile'
import type { UsersMe } from '../../types/api'

Page({
  data: {
    id: DEFAULT_ID,
    avatar: '',
    itemCount: 0,
    spaceCount: 0
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
    const profile = loadProfile()
    this.setData({
      id: profile.id,
      avatar: profile.avatar
    })
    this.fetchMe()
  },

  /** 当前用户统计（契约 v1.3 §5.3）：失败保持现有展示，不弹窗打扰 */
  fetchMe() {
    const that = this
    getMe().then(function (res) {
      const me = res as UsersMe & { __error?: true }
      if (!me || me.__error) return
      that.setData({ itemCount: me.itemCount, spaceCount: me.spaceCount })
    }).catch(function () { /* 静默：保留兜底展示 */ })
  }
})
