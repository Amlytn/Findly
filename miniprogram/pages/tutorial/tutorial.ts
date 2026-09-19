interface TutorialStep {
  no: string
  title: string
  desc: string
}

/** 三步核心闭环（登记 → 位置 → 找回），与 PRD 第 1.3 节使用闭环一致 */
const STEPS: TutorialStep[] = [
  {
    no: '01',
    title: '拍一拍，AI 帮你记',
    desc: '拍一张物品照片，AI 会自动识别名称、分类、品牌、颜色等信息。识别结果可以随时修改，确认之后才会正式保存；也可以手动添加物品，再从相册配一张照片。'
  },
  {
    no: '02',
    title: '给它一个位置',
    desc: '把物品放进层级空间，例如「我的家 → 书房 → 书桌 → 右侧抽屉」。任意层级都能作为存放点，选位置时也可以直接新建空间。'
  },
  {
    no: '03',
    title: '一句话找回',
    desc: '打开搜索页，输入「我的白色鼠标在哪里」，就能直达物品详情和完整位置路径。关键词和自然语言两种问法都支持。'
  }
]

Page({
  data: {
    steps: STEPS
  },

  /** 教程转化入口：直达拍照页开始登记第一件物品 */
  goCamera() {
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  /** 更多疑问 → 复用常见问题文档 */
  goFaq() {
    wx.navigateTo({ url: '/pages/doc/doc?type=faq' })
  }
})
