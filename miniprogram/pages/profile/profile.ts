import { getMe } from '../../services/users'
import { DEFAULT_ID, loadProfile, avatarUrl } from '../../utils/profile'
import type { UsersMe } from '../../types/api'

Page({
  data: {
    id: DEFAULT_ID,
    avatar: '',
    /** 昵称：getMe 成功后用后端昵称，未设置/失败时回退展示 ID */
    displayName: DEFAULT_ID,
    /** 统计失败时展示 –，避免弱网下把真实物品数误显示为 0 */
    itemCount: '–',
    spaceCount: '–'
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
    // 资料编辑页保存后返回，这里刷新头像与 ID；头像本地兜底先上，getMe 成功后云端值覆盖
    const profile = loadProfile()
    this.setData({
      id: profile.id,
      avatar: avatarUrl(profile.avatar),
      displayName: profile.id
    })
    this.fetchMe()
  },

  /** 当前用户统计（契约 v1.3 §5.3）：失败保持现有展示，不弹窗打扰 */
  fetchMe() {
    const that = this
    getMe().then(function (res) {
      const me = res as UsersMe & { __error?: true }
      if (!me || me.__error) return
      that.setData({
        displayName: me.nickname || that.data.id,
        // 云端头像为真相源：设置过就展示，未设置(null)保留本地兜底
        avatar: me.avatar ? avatarUrl(me.avatar) : that.data.avatar,
        itemCount: me.itemCount,
        spaceCount: me.spaceCount
      })
    }).catch(function () { /* 静默：统计保持 –，不把失败伪装成 0 */ })
  }
})
