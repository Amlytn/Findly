import { cropToSquare } from '../../utils/crop'

Page({
  data: {
    /** <camera> 闪光灯值：on / off（可扩展 torch 常亮） */
    flash: 'off' as 'on' | 'off',
    /** 相机授权失败等异常时降级为相册选择 */
    cameraOk: true,
    /** 快门防抖：拍照/裁切期间禁用 */
    shooting: false,
    statusBarHeight: 20,
    navTotal: 64
  },

  onLoad() {
    // 异形屏适配：注入实测的状态栏高度与导航区总高度
    const app = getApp() as any
    const sbh = (app.globalData && app.globalData.statusBarHeight) || 20
    const nbh = (app.globalData && app.globalData.navBarHeight) || 44
    this.setData({ statusBarHeight: sbh, navTotal: sbh + nbh })
  },

  onShow() {
    // 从识别结果页返回时恢复快门可用
    this.setData({ shooting: false })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  toggleFlash() {
    this.setData({ flash: this.data.flash === 'on' ? 'off' : 'on' })
  },

  /** 相机组件异常（授权拒绝/被占用）：降级相册流程 */
  onCameraError() {
    this.setData({ cameraOk: false })
    wx.showToast({ title: '相机不可用，请从相册选择', icon: 'none' })
  },

  /** 快门：取景拍照 → 居中裁 1:1 → 识别结果页 */
  shoot() {
    if (this.data.shooting || !this.data.cameraOk) return
    this.setData({ shooting: true })
    const ctx = wx.createCameraContext()
    const that = this
    ctx.takePhoto({
      quality: 'high',
      success(res) {
        that.afterPick(res.tempImagePath)
      },
      fail() {
        that.setData({ shooting: false })
        wx.showToast({ title: '拍照失败，请重试', icon: 'none' })
      }
    })
  },

  /** 相册入口：选图 → 同一套后处理 */
  pickFromAlbum() {
    if (this.data.shooting) return
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success(res) {
        that.afterPick(res.tempFiles[0].tempFilePath)
      },
      fail() { /* 用户取消，静默 */ }
    })
  },

  /** 统一后处理：原图留给详情页完整展示，方图走识别与列表；进结果页发起 AI */
  afterPick(raw: string) {
    const app = getApp() as any
    app.globalData.recognizeImgFull = raw
    app.globalData.recognizePending = true
    const go = function () {
      wx.navigateTo({ url: '/pages/result/result' })
    }
    cropToSquare(raw)
      .then(function (sq: string) {
        app.globalData.recognizeImg = sq
        go()
      })
      .catch(function () {
        // 裁切失败则退回原图，不阻断流程
        app.globalData.recognizeImg = raw
        go()
      })
  }
})
