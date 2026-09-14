# Findly 寻物

基于 AI 的个人物品管理与搜索微信小程序——给你的现实世界一个搜索框。

拍照识别物品，记录它收纳在哪个空间（家 → 书房 → 书桌 → 抽屉），之后用一句话把它找出来。

## 目录结构

```
design/           品牌资产
  brand/            图标定稿源文件（唯一构建源）
  findly-icon-set/  标准图标集（脚本生成，勿手改）
miniprogram/      微信小程序端（原生 + TypeScript）
server/           后端（NestJS + PostgreSQL）
```

两端工程尚在初始化阶段，目录先以占位形式存在。

## 设计资产维护

图标集全部由 `design/brand/F-icon-transparent.svg` 派生。修改定稿源之后，须在 `design/findly-icon-set/` 下重新生成并校验：

```bash
node tools/build.mjs
python tools/validate.py
```

`assets/` 下的任何文件都不应手工编辑，一切以构建脚本输出为准。

## 协作约定

- 主分支 `main` 保持稳定，功能开发走 `feature/xxx` 分支，合并前互相过目。
- 环境与密钥只存在于本地 `.env`（仓库提供 `.env.example` 模板），任何 API Key、AppSecret 不得提交。
- 换行符统一 LF、缩进统一 2 空格，由 `.gitattributes` / `.editorconfig` 约束，编辑器请安装 EditorConfig 插件。
- 前端接口约定、数据库结构等协作文档以 PR 形式提交到仓库 `docs/`（随代码演进维护）。
