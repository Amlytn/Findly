Page({
  /** AI 拍摄识别 → 进入内置相机取景页（真实取景 + 快门 + 闪光灯） */
  goCamera() {
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  /** 手动添加：直接进识别结果页空表单（不触发 AI），照片区可点击从相册配图，名称行可点填 */
  manualAdd() {
    const app = getApp() as any
    app.globalData.recognizeImg = ''
    app.globalData.recognizeImgFull = ''
    app.globalData.recognizePending = false
    // 同拍照/相册流程：清空位置残留，避免继承上次流程的选择
    app.globalData.locationId = ''
    app.globalData.locationPath = []
    wx.navigateTo({ url: '/pages/result/result' })
  }
})
