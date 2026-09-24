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
  pages/            页面（index / items / spaces / profile / camera / add / result / location / detail / search / results / settings / profile-edit / usage / doc / tutorial / favorites / stats / common-spaces，共 19 屏）
  components/nav-bar/  +  custom-tab-bar/（自定义底部导航，中间凸起 ➕）
  services/         统一接口层（request / items / spaces / ai / search / auth / upload / users / stats）
  assets/           图片资源（banner 背景、logo 与 item-*.jpg 演示物品图，后者仅供测试填充使用）
server/           后端（NestJS + Prisma + PostgreSQL）
  src/              全模块已实现：ai / search / items / spaces / auth / users / upload / common / prisma
  prisma/           schema.prisma（六表）+ 迁移 + seed.ts
```

协作文档四份，都在 `docs/` 下、随代码维护：**`architecture.md`**（系统架构与请求生命周期）、**`api.md`**（接口契约，改接口先改它）、**`database.md`**（表 / 索引 / 外键动作 / 迁移与 provider 一致性）、**`ai.md`**（AI 链路、成本防线与统计口径）。

小程序端 19 屏界面已全部落地并接入真实后端 API（JWT 鉴权、图片上传、AI 识物与智能搜索）；后端业务模块与自动化单元测试均已完成并接入 CI 流水线。

## 快速开始（本机跑起来）

下面每条命令都在 Windows + Node 24 / PostgreSQL 16 上实跑过。前置只有一件事：**本机有个能连上的 PostgreSQL**（默认端口 5432）。

```bash
cd server
npm ci                              # 严格按 package-lock 安装
cp .env.example .env                # Windows 下用 copy
npx prisma migrate deploy           # 建表；库不存在会自动建（前提是该角色有 CREATEDB 权限）
npm run seed                        # 灌演示数据：1 用户 / 6 个空间（4 层树）/ 6 件带图物品
npm run build
node dist/src/main.js               # ⚠️ 入口是 dist/src/main.js，不是 dist/main.js
```

`.env` 里和"能不能跑起来"相关的四项：

| 键 | 不填会怎样 |
|---|---|
| `DATABASE_URL` | 起不来。默认 `postgresql://findly:findly@localhost:5432/findly` |
| `DASHSCOPE_API_KEY` | **只有识图/智能搜索的用不了**，接口如实返回 503「未配置 DASHSCOPE_API_KEY」；增删改查、关键词搜索、位置树照常演示 |
| `NODE_ENV` + `AUTH_DEV_TOKEN="1"` | 两者都满足时 `/auth/dev-token` 才开放（生产环境该通道恒 403），本机演示拿登录态靠它 |
| `WX_APPID` / `WX_APPSECRET` | 填真实值才能走通 `POST /auth/login` 的真微信登录。**没拿到也没关系**，用下面的演示登录态即可 |

后端起来后自检一把：

```bash
curl -s "http://localhost:3000/api/v1/auth/dev-token?userId=dev"   # 应返回 {"token":"eyJ..."}
```

### 打开小程序端

用**微信开发者工具**（只有 Windows / Mac 版，没有手机版）「导入项目」，目录选仓库里的 `miniprogram/`：

- `project.config.json` 已带 appid，且 `urlCheck: false` —— 所以访问 `http://localhost:3000` 不会被"合法域名"拦，**不需要注册小程序账号、不需要发布**就能本机演示。
- `useCompilerPlugins: ["typescript"]` 已开，`.ts` 由工具自动编译，不用手动 build 前端。
- 开发环境地址在 `services/config.ts` 里自动生效（`develop → http://localhost:3000`），无需改代码。

### 演示登录态（没配微信 AppSecret 时用这个）

小程序端 `services/auth.ts` 不做任何测试兜底（登录失败就如实抛错），所以本机演示要手动塞一次登录态：

1. 取一个 token：`curl -s "http://localhost:3000/api/v1/auth/dev-token?userId=dev"`
2. 开发者工具顶部「调试器」→ **Storage** 面板 → 新建键 `findly_token`，值填（`ts` 用当前毫秒时间戳）：

   ```json
   { "token": "第 1 步拿到的整串", "ts": 1790000000000 }
   ```

3. 点「编译」刷新，即可正常浏览、搜索、拍照识别（识图需 `DASHSCOPE_API_KEY`）。

> token 7 天有效，本地缓存超过 6 天会判过期重取。想演示"两个账号数据互不可见"，用 `?userId=别人` 再取一个、换到另一台机器/清缓存后登录即可 —— 每个 `userId` 只看得到自己的物品、空间与用量。

### 想还原初始演示画面 / 跑测试

```bash
npm run seed -- --force     # 清掉 dev 的空间/物品/标签后重灌（物品图会从 prisma/demo-assets/ 重新拷进 uploads/）
npm test                    # 116 个单元测试 / 13 个套件，全部 mock Prisma，不需要数据库
```

演示物品图复用 `miniprogram/assets/item-*.jpg`（本来就在仓库里），`seed` 时拷进 `server/uploads/`（不入库）—— 因为前端只给含 `/uploads/` 的图片地址追加访问凭证，图必须落在那个目录才显示得出来。

## 设计资产维护

图标集全部由 `design/brand/F-icon-transparent.svg` 派生。修改定稿源之后，须在 `design/findly-icon-set/` 下重新生成并校验：

```bash
node tools/build.mjs
python tools/validate.py
```

`design/findly-icon-set/assets/` 下的任何文件都不应手工编辑，一切以构建脚本输出为准。

## 协作约定

- 主分支 `main` 保持稳定，功能开发走 `feature/xxx` 分支，合并前互相过目。
- 环境与密钥只存在于本地 `.env`（`.env.example` 模板随工程初始化提供），任何 API Key、AppSecret 不得提交。
- 换行符统一 LF、缩进统一 2 空格，由 `.gitattributes` / `.editorconfig` 约束，编辑器请安装 EditorConfig 插件。
- 前端接口约定、数据库结构等协作文档以 PR 形式提交到仓库 `docs/`（随代码演进维护）。
