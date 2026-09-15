import { cropToSquare } from '../../utils/crop'

Page({
  /** 从相册/相机选择 → 居中裁 1:1 → 识别结果 */
  fromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res: any) => {
        const raw = res.tempFiles[0].tempFilePath
        const app = getApp() as any
        app.globalData.recognizeImgFull = raw
        const go = function () {
          wx.navigateTo({ url: '/pages/result/result' })
        }
        cropToSquare(raw)
          .then(function (sq: string) {
            app.globalData.recognizeImg = sq
            go()
          })
          .catch(function () {
            app.globalData.recognizeImg = raw
            go()
          })
      }
    })
  },

  manualAdd() {
    wx.showToast({ title: '手动添加表单开发中', icon: 'none' })
  }
})
