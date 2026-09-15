Page({
  /** 从相册/相机选择 → 识别结果页（result 页发起 /ai/recognize） */
  fromAlbum() {
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
  },

  /** 手动添加：直接进识别结果页空表单（不触发 AI），名称行可点填 */
  manualAdd() {
    const app = getApp() as any
    app.globalData.recognizeImg = ''
    app.globalData.recognizePending = false
    wx.navigateTo({ url: '/pages/result/result' })
  }
})
