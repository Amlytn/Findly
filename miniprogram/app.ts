import { ensureLogin } from './services/auth'

export interface GlobalData {
  version: string
  statusBarHeight: number
  navBarHeight: number
  recognizeImg: string
  recognizeImgFull: string
  locationPath: string[]
  /** 位置选择回填的真实空间 id（保存物品 spaceId 用，M4 前以选中叶子为准） */
  locationId: string
  /** 本次识图是否待发起（result 页消费后清除，防 onShow 重复调 AI） */
  recognizePending: boolean
  /** 跨页面传递的焦点空间 ID（spaces 页自动展开抽屉用） */
  focusSpaceId?: string
}

export interface IAppOption {
  globalData: GlobalData
}

App({
  onLaunch() {
    // 静默登录（契约 v1.3）：换取 JWT 供后续请求使用；失败不阻塞启动，
    // 请求层仍带 x-user-id 兜底，下次进入或触发 401 时重试
    ensureLogin().catch(function () { /* 联调环境后端未启动等场景静默 */ })

    // 异形屏适配：实测状态栏高度 + 胶囊按钮位置反推导航栏高度
    // 不依赖 CSS env(safe-area-inset-top)（工具/部分安卓机型返回 0）
    try {
      const win = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const capsule = wx.getMenuButtonBoundingClientRect()
      const sbh = win.statusBarHeight || 20
      // 胶囊与状态栏的间距上下各留一份，得到与胶囊垂直居中的导航栏高度
      const gap = capsule.top - sbh
      ;(this as any).globalData.statusBarHeight = sbh
      ;(this as any).globalData.navBarHeight = gap * 2 + capsule.height
    } catch (e) {
      ;(this as any).globalData.statusBarHeight = 20
      ;(this as any).globalData.navBarHeight = 44
    }
  },
  globalData: {
    version: '1.0.0',
    statusBarHeight: 20,
    navBarHeight: 44,
    // 拍照识别 → 识别结果 传递的照片：裁好的 1:1 方图（供列表/缩略使用）
    recognizeImg: '',
    // 用户原始照片（详情页完整展示用）
    recognizeImgFull: '',
    // 位置选择 → 识别结果 回填的位置路径
    locationPath: [],
    locationId: '',
    recognizePending: false,
    focusSpaceId: ''
  } as GlobalData
})
