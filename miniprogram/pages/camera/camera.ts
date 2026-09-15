import { cropToSquare } from '../../utils/crop'

Page({
  data: {
    flashOn: false,
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

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  toggleFlash() {
    this.setData({ flashOn: !this.data.flashOn })
  },

  /** 快门 / 相册入口：选图 → 居中裁 1:1 → 进入识别结果页 */
  pick() {
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
            // 裁切失败则退回原图，不阻断流程
            app.globalData.recognizeImg = raw
            go()
          })
      }
    })
  }
})
