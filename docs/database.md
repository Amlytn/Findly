# Findly 数据库说明

> 维护人：@james-wu66 ｜ 首版 2026-09-23，数据基准 main = `4154a49`
> 字段定义的唯一真相是 `server/prisma/schema.prisma`。本文讲的是**为什么这么设计**和**库里实际长什么样**，不重复抄字段表。
> 本文所有数字都是实测值，复核命令见第 1 节。

## 1. 自己核一遍（别信文档，信查询）

```bash
cd "C:\Hermesfindlly新项目\git 仓库\server"

npx prisma validate                      # schema 语法 + datasource URL 是否自洽
npm run prisma:check                     # schema 的 provider 与迁移锁是否一致（见第 6 节）
npx prisma migrate status                # 迁移是否都已应用、有没有 drift

# 库实况（跑在 server 目录下，复用已装好的 Prisma Client）
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
p.$queryRawUnsafe(\"SELECT tablename,indexname FROM pg_indexes WHERE schemaname='public' ORDER BY tablename\").then(r=>{console.table(r);return p.$disconnect()})"
```

## 2. 六张表

| 表 | 职责 | 关键约定 |
|---|---|---|
| `User` | 账号 | `openid` 唯一（微信身份）；本地联调用 `dev` 这一条 |
| `Space` | 位置树 | `parentId` 自引用成树；深度上限 **20 层**（见第 7 节） |
| `Item` | 物品 | **软删除**：`deletedAt` 非空即在回收站，所有查询都要带 `deletedAt: null` |
| `Tag` | 标签 | `@@unique([userId, name])` ⇒ 同名标签在一个用户内只有一条 |
| `ItemTag` | 物品↔标签 | 复合主键 `(itemId, tagId)`；另建 `tagId` 索引供反查 |
| `AIResult` | AI 调用记录 | 每次 recognize / parse-query 一行，**成本与降级统计的唯一数据源** |

实测**业务表共 43 列**（AIResult 7 + Item 16 + ItemTag 2 + Space 9 + Tag 3 + User 6；`information_schema` 查出来是 51，多出的 8 列属于 Prisma 自己的 `_prisma_migrations`）。
除 `ItemTag` 之外的五张表都有 `id`，一律 `cuid()` 字符串；`ItemTag` 是纯关联表，用复合主键 `(itemId, tagId)`，没有 id 列。

## 3. 外键与删除动作（实测 8 条）

| 外键 | onUpdate | onDelete | 为什么 |
|---|---|---|---|
| `Item.userId → User` | CASCADE | **RESTRICT** | 用户名下还有东西就删不掉人 |
| `Space.userId → User` | CASCADE | RESTRICT | 同上 |
| `Tag.userId → User` | CASCADE | RESTRICT | 同上 |
| `Item.spaceId → Space` | CASCADE | **SET NULL** | 删空间不能连带删物品 ⇒ 物品回到"未归位" |
| `Space.parentId → Space` | CASCADE | **SET NULL** | 删父空间时子空间升为根，而不是级联删掉整棵树 |
| `ItemTag.itemId → Item` | CASCADE | RESTRICT | 关联表不许出现悬空指针 |
| `ItemTag.tagId → Tag` | CASCADE | RESTRICT | 同上 |
| `AIResult.itemId → Item` | CASCADE | **SET NULL** | 识别记录是账本，物品删了记录要留着（成本可追溯） |

⚠️ 这套 `SET NULL` 有一个已坐实的副作用，见第 8 节 C25。

## 4. 索引（实测业务表 15 条 = 6 主键 + 2 唯一 + 7 普通；连 `_prisma_migrations` 自己那条主键共 16 条）

7 条普通索引每一条都对应一个真实查询，不是"习惯性加一下"：

| 索引 | 服务的查询 |
|---|---|
| `Item(userId, spaceId)` | 列表页"某空间下的物品"，同时天然支持按 userId 的前缀过滤 |
| `Item(name)` | 关键词搜索的 `name contains` 分支 |
| `Space(userId)` | 位置树整棵树按用户装载 |
| `ItemTag(tagId)` | `items.related()` 的反向查询 `tags.some.tagId in [...]`。**复合主键的最左列是 itemId，满足不了这个方向** ⇒ 没这条就全表扫（C04） |
| `AIResult(userId)` | `/stats` 按调用者过滤（C09） |
| `AIResult(createdAt)` | `/stats?days=N` 的时间范围（C08） |
| `AIResult(itemId)` | 详情页"最近 5 次识别记录"。**PostgreSQL 不会为外键自动建索引**，不补就是全表扫 |

刻意**没建**的：`AIResult.taskType` —— 只有两个取值、基数极低，走索引比顺序扫还慢。

## 5. 迁移（3 份）

| 迁移 | 内容 |
|---|---|
| `20260914163942_init`（115 行） | 建六张表 + 初始索引 + 外键 |
| `20260921090000_add_space_icon_type`（2 行） | `Space` 加 `icon` / `type` |
| `20260922143000_add_airesult_user_scope`（27 行） | `AIResult` 加 `userId` + 4 条索引（C09/C04/C08） |

**后两份是手写的**，不是 `prisma migrate dev` 生成的。原因：本机 `prisma migrate dev` 需要一个干净的影子库，而开发库里有真实数据，跑一次就会把本地状态搞乱。手写时要自己保证与 `schema.prisma` 一致 —— 这个"一致"现在由 CI 兜（第 6 节）。

那份 C09 迁移里有一段**诚实回填**值得记：

```sql
UPDATE "AIResult" a SET "userId" = i."userId"
FROM "Item" i WHERE a."itemId" = i.id AND a."userId" IS NULL;
```

只回填"能经 Item 反查出归属"的行，剩下的留 `null` 而不是猜一个用户。`/stats` 因此额外暴露 `unattributed` 字段如实报数。本地那 25 条无归属记录已于 2026-09-23 删除（删前整表归档），所以现在这个数是 0。

## 6. provider 与迁移锁必须一致（09-21 事故换来的检查）

**事故**：一个 PR 把 `datasource db { provider }` 改成了 `sqlite` 提交进 main，而三份迁移全是 PostgreSQL 方言 ⇒ main 上后端直接起不来（`P1012`）。**CI 当时全绿** —— 单元测试把 Prisma 整个 mock 掉了，构建阶段只跑 `prisma generate`，它不校验 provider。

**定位方法**（三处交叉证据，不是猜）：`migrations/migration_lock.toml` 写着 `postgresql` + 迁移 SQL 用的是 PG 方言（`ADD COLUMN`、`CREATE INDEX`、`::text` 默认值）+ 该 PR 自己的提交信息写着"PG 兼容迁移"。三处都指向"schema 那一行是误改"。

**现在 CI 有两道**（`ci.yml` 的 "Prisma schema 校验（S1）"）：

| 检查 | 能抓什么 | 实测 |
|---|---|---|
| `npx prisma validate` | schema 语法、provider 与 `DATABASE_URL` 协议是否匹配 | provider=sqlite + postgres URL ⇒ **退出 1** ✅ |
| `npm run prisma:check` | schema 的 provider 与 `migration_lock.toml` 是否一致 | provider=sqlite + `file:` URL ⇒ validate **退出 0 放过**，这条退出 1 ✅ |

第二道不是多余的：实测证明只加 `prisma validate` 会留一个洞。脚本里取 provider 的正则**必须锚定 `datasource` 块** —— `schema.prisma` 里 `generator` 块在前，朴素匹配第一个 `provider = "..."` 拿到的是 `prisma-client-js`，那样比对永远比不出真相（也实测过）。

**仍未覆盖**：provider 一致、但 schema 与迁移不同步（drift）。那要 `prisma migrate diff --from-migrations ... --shadow-database-url ...`，需要一个真库当影子库，CI 得加 service container。

## 7. 数据一致性约定

- **软删除**：`Item.deletedAt`。列表/搜索/统计一律带 `deletedAt: null`；`remove()` 对已删除的返回 404，前端按"不存在即成功"处理。
- **归属**：所有查询都带 `userId`。这是 C09/C14 两条同源缺陷（统计跨用户可见、识别记录跨用户抢占）修完之后统一收的口径 —— 新增查询时先问自己"这条 where 带 userId 了吗"。
- **空间树**：`parentId` 自引用。挪动时 `assertPlacement` 沿父链回溯一次，同时做**环检测**和**深度校验**，上限 `MAX_SPACE_DEPTH = 20`（`common/path.util.ts` 导出，两处共用）。改前是两个不同的数（环检测 50 / 拼路径 20），后果实测过：25 层链的路径被静默截断成 20 段、60 层链能把链顶挪到链底造出真环。
- **标签**：`Tag(userId, name)` 唯一 + 写入前 `trim`/丢空/去重（`items.service.ts` 的 `tagOps`）。整体替换走事务：先 `deleteMany` 旧关联再 `create` 新关联。
- **AIResult 回填**：`updateMany` 的 where 必须同时含 `id` / `itemId: null` / `userId`。

## 8. 已知边界（都实测过，不是列着好看）

| 编号 | 事实 | 状态 |
|---|---|---|
| **C25** | 一个**只含软删除物品**的空间可以被删除，而 `Item_spaceId_fkey` 是 `SET NULL` ⇒ 回收站里那些物品的 `spaceId` 被静默清成 null，**位置丢了但物品还在**。09-23 实测：删空间返回 200，软删物品 `spaceId = null`、`deletedAt` 仍在 | ⬜ 未修。修法二选一：删除保护把 `deletedAt: null` 的条件去掉（连带统计回收站物品），或软删物品时保留一份位置快照。**要改先定产品口径**："回收站可恢复"到底要不要保住位置 |
| C18 | 图片访问日志现在有了（`common/uploads-auth.ts`），但它**不在 Nest 拦截器链路里**，格式与业务日志不同源 | ✅ 已按当前设计接受 |
| — | `thumbnailUrl` 字段在库里、DTO 不收、前端不用 ⇒ 列表仍加载原图 | ⬜ G9，要前端配合 |
| — | 备份策略、`uploads/` 持久卷 | ⬜ 属部署批次，未做 |
| — | 对象存储 + 签名 URL（替代本地 `uploads/` 与 `?token=`） | ⬜ 长期方案 |
