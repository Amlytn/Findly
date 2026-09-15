Page({
  data: {
    flashOn: false
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  toggleFlash() {
    this.setData({ flashOn: !this.data.flashOn })
  },

  /** 快门 / 相册入口：选图后进入识别结果页（识图在 result 页发起） */
  pick() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res: any) => {
        const app = getApp() as any
        app.globalData.recognizeImg = res.tempFiles[0].tempFilePath
        app.globalData.recognizePending = true
        wx.navigateTo({ url: '/pages/result/result' })
      }
    })
  }
})
