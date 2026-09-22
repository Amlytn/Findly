-- C09 + C04 + C08：AIResult 增加调用归属 userId，并补齐统计与关联查询所需索引。
--
-- 说明：本文件为手写迁移（与上一份 20260921090000_add_space_icon_type 同法），未跑
-- `prisma migrate diff`——该命令需要影子库、要额外建库权限。SQL 为 PostgreSQL 方言，
-- 与 datasource.provider=postgresql 及 migration_lock.toml 一致。
-- 合并前后端需用 `npx prisma validate` + 起服务实测复核列名与索引名。

-- AlterTable：新增归属列。可空——历史记录中无法判定归属的保持 null，不猜。
ALTER TABLE "AIResult" ADD COLUMN "userId" TEXT;

-- 如实回填：凡已保存成物品的识别记录，可经 Item 反查出真实归属（不依赖应用层重放）。
-- 识别后未保存物品的记录无从判定，留在 null 里，由统计接口单独报数而不是混进结果。
UPDATE "AIResult" a SET "userId" = i."userId"
FROM "Item" i
WHERE a."itemId" = i.id AND a."userId" IS NULL;

-- CreateIndex
CREATE INDEX "AIResult_userId_idx" ON "AIResult"("userId");

-- CreateIndex
CREATE INDEX "AIResult_createdAt_idx" ON "AIResult"("createdAt");

-- CreateIndex
CREATE INDEX "AIResult_itemId_idx" ON "AIResult"("itemId");

-- CreateIndex（C04：items.related() 的 tags.some.tagId in [...] 反方向查询）
CREATE INDEX "ItemTag_tagId_idx" ON "ItemTag"("tagId");
