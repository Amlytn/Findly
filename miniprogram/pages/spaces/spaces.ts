import { SPACES } from '../../utils/data'

Page({
  data: {
    spaces: SPACES
  },

  goSpace(e: any) {
    wx.showToast({ title: '空间详情开发中', icon: 'none' })
  },

  addSpace() {
    wx.showToast({ title: '添加空间开发中', icon: 'none' })
  },

  onShow() {
    const bar = typeof (this as any).getTabBar === 'function' && (this as any).getTabBar()
    if (bar) {
      bar.setData({ selected: 2 })
    }
  }
})
