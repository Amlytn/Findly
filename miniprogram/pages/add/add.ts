import { cropToSquare } from '../../utils/crop'

Page({
  /** AI 拍摄识别 → 进入内置相机取景页（真实取景 + 快门 + 闪光灯） */
  goCamera() {
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  /** 从相册选择 → 居中裁 1:1 → 识别结果页（result 页发起 /ai/recognize） */
  fromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res: any) => {
        const raw = res.tempFiles[0].tempFilePath
        const app = getApp() as any
        // 原图留给详情页完整展示；方图走识别与列表
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
  },

  /** 手动添加：直接进识别结果页空表单（不触发 AI），名称行可点填 */
  manualAdd() {
    const app = getApp() as any
    app.globalData.recognizeImg = ''
    app.globalData.recognizeImgFull = ''
    app.globalData.recognizePending = false
    wx.navigateTo({ url: '/pages/result/result' })
  }
})
