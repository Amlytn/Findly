# Findly 寻物

基于 AI 的个人物品管理与搜索微信小程序——给你的现实世界一个搜索框。

拍照识别物品，记录它收纳在哪个空间（家 → 书房 → 书桌 → 抽屉），之后用一句话把它找出来。

## 目录结构

```
design/           品牌资产
  brand/            图标定稿源文件（唯一构建源）
  findly-icon-set/  标准图标集（脚本生成，勿手改）
docs/             协作文档（架构 / API / 数据库 / AI，随代码演进维护）
miniprogram/      微信小程序端（原生 + TypeScript）
  app.json 等       工程入口（project.private.config.json 不入库）
  pages/            页面（index / items / spaces / profile / camera / add / result / location / detail / search / results / settings，对应设计稿 12 屏）
  components/nav-bar/  +  custom-tab-bar/（自定义底部导航，中间凸起 ➕）
  utils/data.ts     共享模拟数据层（联调时替换为 services 接口封装）
server/           后端（NestJS + Prisma + PostgreSQL）
  src/              已建 ai / search / common / prisma；items / spaces / auth / users / upload 待开发（见 docs/api.md「同学模块」标注）
  prisma/           schema.prisma（六表）+ seed.ts
```

小程序端 12 屏界面已落地（当前为本地模拟数据，未接后端）；后端地基与 AI/搜索模块已实现，物品/空间接口待补。

## 设计资产维护

图标集全部由 `design/brand/F-icon-transparent.svg` 派生。修改定稿源之后，须在 `design/findly-icon-set/` 下重新生成并校验：

```bash
node tools/build.mjs
python tools/validate.py
```

`assets/` 下的任何文件都不应手工编辑，一切以构建脚本输出为准。

## 协作约定

- 主分支 `main` 保持稳定，功能开发走 `feature/xxx` 分支，合并前互相过目。
- 环境与密钥只存在于本地 `.env`（`.env.example` 模板随工程初始化提供），任何 API Key、AppSecret 不得提交。
- 换行符统一 LF、缩进统一 2 空格，由 `.gitattributes` / `.editorconfig` 约束，编辑器请安装 EditorConfig 插件。
- 前端接口约定、数据库结构等协作文档以 PR 形式提交到仓库 `docs/`（随代码演进维护）。
