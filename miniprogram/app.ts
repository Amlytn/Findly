App({
  onLaunch() {
    // 小程序启动逻辑（后续可在此拉取用户数据 / 登录）
  },
  globalData: {
    version: '1.0.0',
    // 拍照识别 → 识别结果 传递的照片临时路径
    recognizeImg: '',
    // 位置选择 → 识别结果 回填的位置路径（名称数组，用于展示）
    locationPath: [] as string[],
    // 位置选择回填的真实空间 id（保存物品用；M4 前以选中叶子为准）
    locationId: '',
    // 本次识图是否待发起（result 页消费后清除，防 onShow 重复调 AI）
    recognizePending: false
  }
})
