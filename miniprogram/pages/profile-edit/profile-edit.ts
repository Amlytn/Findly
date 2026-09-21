import { cropToSquare, shrinkToMaxEdge } from '../../utils/crop'
import { DEFAULT_ID, loadProfile, saveProfile, avatarUrl } from '../../utils/profile'
import { updateMe } from '../../services/users'
import { uploadImage } from '../../services/upload'
import { checkName } from '../../utils/validate'

Page({
  data: {
    id: DEFAULT_ID,
    avatar: '',
    /** 本地暂存头像（temp 文件路径），保存时才上传转云端 URL */
    pendingAvatar: '',
    saving: false
  },

  onLoad() {
    this.reload()
  },

  reload() {
    const profile = loadProfile()
    this.setData({
      id: profile.id || DEFAULT_ID,
      avatar: profile.avatar || '',
      pendingAvatar: ''
    })
  },

  onId(e: any) {
    this.setData({ id: e.detail.value })
  },

  /** 选图 → 居中裁 1:1（temp 路径重启即失效，保存时统一上传转云端 URL） */
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res: any) => {
        const raw = res.tempFiles[0].tempFilePath
        cropToSquare(raw)
          .then((sq: string) => this.setData({ pendingAvatar: sq }))
          // 裁切失败退回原图，不阻断流程
          .catch(() => this.setData({ pendingAvatar: raw }))
      }
    })
  },

  /**
   * 保存：昵称与头像写云端（PATCH /users/me）；头像先压缩上传拿相对路径。
   * 本地缓存始终同步一份作离线兜底；云端失败时明确告知，不伪装成功。
   */
  save() {
    if (this.data.saving) return
    const id = (this.data.id || '').trim()
    if (!id) {
      wx.showToast({ title: 'ID 不能为空', icon: 'none' })
      return
    }
    const lenErr = checkName(id, '昵称')
    if (lenErr) {
      wx.showToast({ title: lenErr, icon: 'none' })
      return
    }
    this.setData({ saving: true })

    const pending = this.data.pendingAvatar
    const prevAvatar = this.data.avatar
    const that = this
    const finish = function (avatarForCache: string) {
      // 无论云端成败，本地兜底缓存始终同步，离线/弱网可见
      saveProfile({ id: id, avatar: avatarForCache })
      setTimeout(function () {
        const pages = getCurrentPages()
        const top = pages[pages.length - 1]
        if (top && top.route === 'pages/profile-edit/profile-edit') {
          wx.navigateBack({ delta: 1 })
        }
      }, 600)
    }

    const patchRemote = function (avatarRelPath?: string) {
      const dto: { nickname: string; avatar?: string } = { nickname: id }
      if (avatarRelPath) dto.avatar = avatarRelPath
      updateMe(dto)
        .then(function () {
          wx.showToast({ title: '已保存', icon: 'success' })
          finish(avatarRelPath || prevAvatar)
        })
        .catch(function () {
          // 云端失败：本地兜底可见，但明确告知未同步，不伪装成功
          wx.showToast({ title: '已存本机，云端同步失败', icon: 'none' })
          finish(pending || prevAvatar)
        })
    }

    if (pending) {
      // 新头像：压缩 → 上传 → 拿 /uploads/ 相对路径再 PATCH
      shrinkToMaxEdge(pending, 600, 80)
        .then(function (p: string) { return uploadImage(p) })
        .then(function (up: any) { patchRemote(up.imageUrl) })
        .catch(function () {
          wx.showToast({ title: '头像上传失败', icon: 'none' })
          that.setData({ saving: false })
        })
    } else if (id === loadProfile().id) {
      // 无任何变更，直接返回
      finish(prevAvatar)
      that.setData({ saving: false })
    } else {
      patchRemote()
    }
  }
})
