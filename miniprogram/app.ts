App({
  onLaunch() {
    // 小程序启动逻辑（后续可在此拉取用户数据 / 登录）
  },
  globalData: {
    version: '1.0.0',
    // 拍照识别 → 识别结果 传递的照片临时路径
    recognizeImg: '',
    // 位置选择 → 识别结果 回填的位置路径
    locationPath: ['我的家', '书房', '书桌']
  }
})
