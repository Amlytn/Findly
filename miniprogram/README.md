# Findly 微信小程序 · 全套界面

按 12 屏设计稿使用 **WXML + WXSS + TypeScript** 实现，含自定义 TabBar（中间凸起 ➕ 按钮）、青绿品牌配色（对齐 `favicon.svg`）与共享数据层。

## 页面总览（对应设计稿编号）

| # | 页面 | 路径 | 说明 |
|---|---|---|---|
| 1 | 首页 | `pages/index/index` | TabBar 首页，搜索入口、拍照横幅、快捷入口、最近添加 |
| 2 | 拍照识别 | `pages/camera/camera` | 深色取景界面，快门/相册选图后进入识别结果 |
| 3 | 识别结果 | `pages/result/result` | 识别信息 + 位置面包屑 + 保存 |
| 4 | 位置选择 | `pages/location/location` | 树形空间选择器，确定后回填结果页 |
| 5 | 物品详情 | `pages/detail/detail` | 标签、同类物品横滑、猜你想搜、编辑/删除 |
| 6 | 搜索 | `pages/search/search` | AI 智能搜索 + 相关物品 + 搜索建议 |
| 7 | 搜索结果 | `pages/results/results` | 全部/物品/空间 分段筛选，关键词匹配 |
| 8 | 添加物品 | `pages/add/add` | TabBar ➕ 入口，相册识别 / 手动添加 |
| 9 | 我的物品 | `pages/items/items` | TabBar 物品页，分类 chips + 双列网格 |
| 10 | 空间管理 | `pages/spaces/spaces` | TabBar 空间页，空间列表 + 添加空间 |
| 11 | 个人中心 | `pages/profile/profile` | TabBar 我的页，资料卡（点头像进编辑）+ 功能列表 |
| 12 | 设置 | `pages/settings/settings` | 关于、缓存、退出登录 |
| 13 | 资料编辑 | `pages/profile-edit/profile-edit` | 编辑头像（裁 1:1 转持久文件）与 ID，存本地缓存 |

## 目录结构

```
代码/
├── app.ts / app.json / app.wxss      # 全局入口；app.wxss 含共享骨架样式与全部内联 SVG 图标
├── typings.d.ts                      # wx/App/Page 等全局 API 的轻量类型声明
├── project.config.json / tsconfig.json
├── utils/data.ts                     # 共享模拟数据（物品/空间/建议）与搜索匹配逻辑
├── components/nav-bar/               # 通用顶部导航栏（返回 + 标题，Tab 页无上级时回首页）
├── custom-tab-bar/                   # 自定义 TabBar（首页/物品/➕/空间/我的）
├── favicon.svg                       # 品牌图标源文件
├── assets/                           # logo + 9 张物品照片 + 首页横幅背景（AI 生成占位，可换实拍图）
│   ├── hero-bg.jpg                   # 首页横幅背景：3D 渐变场景（蓝绿渐变 + 底部体块 + 右侧同心圆），
│   │                                 # 原图 1455x736 直接使用（未调色），容器 aspectFill 适配 686x354rpx
│   ├── icon-camera-3d.png            # 快捷入口"拍照识别"3D 相机图标（240x240 透明底，源文件见
│   │                                 # 新建文件夹/3d icon/Carmen.png，1254x1254）
│   ├── icon-items-3d.png             # 快捷入口"我的物品"3D 收纳盒图标（240x240 透明底，
│   │                                 # 源文件见 新建文件夹/3d icon/My stuff.png，1254x1254）
│   ├── icon-space-3d.png             # 快捷入口"空间管理"3D 图标（240x240 透明底，
│   │                                 # 源文件见 新建文件夹/3d icon/Space.png，1254x1254）
│   └── icon-recent-3d.png            # 快捷入口"最近查看"3D 图标（240x240 透明底，
│                                     # 源文件见 新建文件夹/3d icon/Recently viewed.png，1254x1254）
└── pages/                            # 12 个页面
```

## 运行方式

1. 打开 **微信开发者工具** → 导入项目 → 选择本目录（`代码/`）。
2. AppID 填自己的，或直接用测试号预览。
3. 已开启 TS 编译插件（`useCompilerPlugins: ["typescript"]`），保存即编译。

## 已打通的交互链路

- 首页搜索栏 / 物品页搜索框 → 搜索页 → 输入确认或点建议 → 搜索结果（全部/物品/空间切换）→ 点结果 → 物品详情
- 首页横幅 → 拍照识别 → 快门/相册选图 → 识别结果 → 更改位置 → 位置选择（树形勾选）→ 确定回填 → 保存回首页
- TabBar ➕ / 添加物品页"从相册选择" → 识别结果
- 首页最近添加 / 物品网格 / 相关物品 → 物品详情（横滑切换同类）
- 个人中心 → 我的物品 / 空间管理 / 设置

## 实现要点

- **rpx 等比适配**：设计稿按 375pt 宽折算，1px = 2rpx。
- **自定义导航栏**：`navigationStyle: "custom"` + `env(safe-area-inset-top)` 避让状态栏；首页扫描入口通过 `wx.getMenuButtonBoundingClientRect()` 实测避让胶囊按钮。
- **页面间数据传递**：识别照片与所选位置经 `app.globalData` 中转（临时文件路径不适合放 URL）。
- **图标零依赖**：全部内联 SVG data URI 定义在 `app.wxss`（`.ic-*` 系列），新页面直接复用。
- **数据层**：`utils/data.ts` 集中管理物品/空间/搜索逻辑，替换为云开发或后端接口时只需改这一个文件。

## 与设计稿的差异说明

- 状态栏由手机系统绘制，无法复刻，真机显示用户实际状态栏。
- 配色策略：品牌主体对齐 `favicon.svg` 青绿系（主渐变 `#31CBBB → #04869D`、强调色 `#12A5A0`）；"我的空间"四色卡片、植物装饰保留设计稿多彩粉彩风格。
- 物品照片为 AI 生成占位图，可替换为真实照片（路径见 `utils/data.ts`）。
- 编辑物品、手动添加表单、空间详情、家庭共享等未在设计稿中出现的界面以 toast 占位。
