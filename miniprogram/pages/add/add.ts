Page({
  /** 从相册/相机选择 → 识别结果 */
  fromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: (res: any) => {
        const app = getApp() as any
        app.globalData.recognizeImg = res.tempFiles[0].tempFilePath
        wx.navigateTo({ url: '/pages/result/result' })
      }
    })
  },

  manualAdd() {
    wx.showToast({ title: '手动添加表单开发中', icon: 'none' })
  }
})
