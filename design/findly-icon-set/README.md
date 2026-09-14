# Findly 标准图标集（SVG 矢量）

由 `F-icon-transparent.svg` 派生的完整标准图标集。**全部图标均为矢量 SVG**，原始图形路径（F 折带、定位图钉、渐变）从源文件逐字节提取，未做任何重绘或变形。

## 目录结构

```
findly-icon-set/
├── README.md                        # 本说明
├── preview.html                     # 全套视觉预览（浏览器打开）
├── assets/                          # 全部图标资源
│   ├── favicon.svg                  # 网站图标（64，扁平版）
│   ├── sprite.svg                   # symbol 合集（5 个符号，网页内联复用）
│   ├── site.webmanifest             # PWA 清单
│   ├── master/
│   │   ├── icon-master.svg          # 主图标：完整版（含柔和投影），1254 viewBox
│   │   └── icon-flat.svg            # 主图标：扁平版（无滤镜，小尺寸更清晰）
│   ├── app/
│   │   ├── icon-dark.svg            # 深色模式应用图标
│   │   ├── icon-circle.svg          # 圆形头像（社交平台 / 团队头像）
│   │   ├── icon-maskable.svg        # PWA 可遮罩图标（图形已缩放至 80% 安全区内）
│   │   └── apple-touch-icon.svg     # iOS 全出血方形（系统自行裁圆角）
│   ├── glyph/                       # 无底稿图形（透明背景）
│   │   ├── glyph.svg                # 原配色：白色 F —— 用于深色 / 品牌色背景
│   │   ├── glyph-teal.svg           # 青绿配色 —— 用于白色 / 浅色背景
│   │   ├── glyph-mono-black.svg     # 单色黑剪影（印刷 / 刻字 / 水印）
│   │   └── glyph-mono-white.svg     # 单色白剪影
│   └── sizes/
│       ├── icon-16 / 24 / 32 / 48 / 64 .svg   # 小尺寸系列（扁平版）
│       └── icon-96 / 128 / 256 / 512 .svg     # 大尺寸系列（完整版）
└── tools/
    └── build.mjs                    # 构建脚本：node tools/build.mjs 重新生成全部图标
```

## 网页接入

```html
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/app/apple-touch-icon.svg">
<link rel="manifest" href="/assets/site.webmanifest">
```

> 部署时将 `assets/` 下被引用的文件放到站点实际路径即可（例如把 `favicon.svg` 复制到站点根目录）；`site.webmanifest` 内的图标路径相对其自身位置解析。

页面 / 组件中直接引用：

```html
<img src="/findly-icon-set/assets/master/icon-master.svg" width="128" alt="Findly">
<img src="/findly-icon-set/assets/sizes/icon-32.svg" width="32" alt="Findly">
```

## Sprite 用法

`assets/sprite.svg` 提供 5 个 symbol：`findly-icon`、`findly-icon-flat`、`findly-glyph`、`findly-glyph-teal`、`findly-mono`。
其中 `findly-mono` 使用 `currentColor`，颜色跟随 CSS 文字色：

```html
<svg width="48" height="57"><use href="/findly-icon-set/assets/sprite.svg#findly-glyph-teal"/></svg>

<span style="color:#fff"><svg width="40" height="47"><use href="/findly-icon-set/assets/sprite.svg#findly-mono"/></svg></span>
```

## 尺寸选择建议

| 场景 | 使用文件 |
|---|---|
| 浏览器标签页 / 收藏夹 16–32 | `assets/favicon.svg`、`assets/sizes/icon-16~32.svg` |
| 桌面快捷方式 / 任务栏 32–64 | `assets/sizes/icon-32~64.svg`（扁平版） |
| 应用列表 / 商店 96–512 | `assets/sizes/icon-96~512.svg`（完整版） |
| 引导页 / 官网 Hero | `assets/master/icon-master.svg`（任意尺寸缩放） |
| PWA 安装图标 | `assets/app/icon-maskable.svg`（manifest 已引用） |
| 深色主题 | `assets/app/icon-dark.svg` |
| 头像 | `assets/app/icon-circle.svg` |

## 说明与注意事项

- **矢量保证**：所有图标均可在任意尺寸无损缩放；文件内 `width/height` 仅为默认展示尺寸，可随意改写。
- **iOS / Windows 栅格格式**：iOS 的 `apple-touch-icon` 与 Windows 的 `.ico`/`.icns` 实际要求 PNG 位图。本套件按要求仅提供矢量源；需要时用浏览器或设计工具从 `assets/app/apple-touch-icon.svg` 导出 180×180 PNG、从 `assets/sizes/icon-16/32/48/256.svg` 导出对应 `.ico` 帧即可。
- **小尺寸简化**：≤64px 采用去投影的扁平版，避免投影在小尺寸糊成色块；≥96px 保留完整光影。
- **maskable 安全区**：图形已按 PWA 规范缩放并居中，最外缘圆形裁切（直径 80%）不会切到图形。
- **重新生成**：修改品牌源文件后，在 `findly-icon-set/` 下运行 `node tools/build.mjs` 即可重建 `assets/` 下全部图标文件（脚本会从 `../brand/F-icon-transparent.svg` 提取图形）。
- 主图标文件较大（约 43KB），因保留了源文件中的高精度圆角方轮廓路径（逐点拟合的 squircle）；如需极限压缩可运行 `svgo` 等工具进一步优化。

## 品牌色速查

| 色值 | 用途 |
|---|---|
| `#31CBBB → #04869D` | 容器主渐变（左上 → 右下） |
| `#1AA9AC` | 品牌主色（theme color） |
| `#FFFFFF → #D3FAFC` | F 字面高光渐变 |
| `#1AA09C → #BFFFEB` | F 中横杠渐变 |
