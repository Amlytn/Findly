import { cropToSquare } from '../../utils/crop'
import { PROFILE_KEY, DEFAULT_ID } from '../../utils/data'

Page({
  data: {
    id: DEFAULT_ID,
    avatar: ''
  },

  onLoad() {
    this.reload()
  },

  reload() {
    const profile = wx.getStorageSync(PROFILE_KEY) || {}
    this.setData({
      id: profile.id || DEFAULT_ID,
      avatar: profile.avatar || ''
    })
  },

  onId(e: any) {
    this.setData({ id: e.detail.value })
  },

  /** 选图 → 居中裁 1:1 → 转存为持久文件（temp 路径重启即失效，不能直接入库） */
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res: any) => {
        const raw = res.tempFiles[0].tempFilePath
        cropToSquare(raw)
          .then((sq: string) => {
            wx.getFileSystemManager().saveFile({
              tempFilePath: sq,
              success: (s: any) => this.setData({ avatar: s.savedFilePath }),
              // 转存失败则退回临时路径，至少本次会话内可用
              fail: () => this.setData({ avatar: sq })
            })
          })
          // 裁切失败退回原图，不阻断流程
          .catch(() => this.setData({ avatar: raw }))
      }
    })
  },

  save() {
    const id = (this.data.id || '').trim()
    if (!id) {
      wx.showToast({ title: 'ID 不能为空', icon: 'none' })
      return
    }
    wx.setStorageSync(PROFILE_KEY, { id: id, avatar: this.data.avatar })
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(function () {
      wx.navigateBack({ delta: 1 })
    }, 600)
  }
})
