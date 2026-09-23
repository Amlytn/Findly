/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pathOf } from '../common/path.util';
import { CreateItemDto, QueryItemsDto, UpdateItemDto } from './dto';

// 卡片/列表/详情共用的关联装载
const itemInclude = { space: true, tags: { include: { tag: true } } };

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  /** tags 字符串数组 → connectOrCreate（Tag 按 userId+name 唯一防重复） */
  private tagOps(userId: string, tags: string[]) {
    return tags.map((name) => ({
      tag: { connectOrCreate: { where: { userId_name: { userId, name } }, create: { userId, name } } },
    }));
  }

	/** spaceId 若提供，必须存在且属于该用户 */
	private async assertSpace(userId: string, spaceId?: string): Promise<string | undefined> {
		if (!spaceId) return undefined;
		const space = await this.prisma.space.findFirst({ where: { id: spaceId, userId } });
		if (!space) throw new BadRequestException('空间不存在或不属于当前用户');
		return spaceId;
	}

	/** update 时的 spaceId 装载：null/空串 = 解绑（移回"未归位"），undefined = 不动 */
	private async spaceFieldForUpdate(
		userId: string,
		spaceId?: string | null,
	): Promise<Prisma.ItemUpdateInput['space']> {
		if (spaceId === null || spaceId === '') return { disconnect: true };
		if (spaceId === undefined) return undefined;
		const id = await this.assertSpace(userId, spaceId);
		return id ? { connect: { id } } : undefined;
	}


  /** 列表/相关物品的统一卡片形状（契约 2：tags 统一为字符串数组 + 完整位置路径） */
  private toCard(r: any, allSpaces?: any[]) {
		return {
			id: r.id,
			name: r.name,
			brand: r.brand,
			model: r.model,
			category: r.category,
			color: r.color,
			quantity: r.quantity,
			tags: (r.tags || []).map((t: any) => t.tag.name),
			space: r.space ? { id: r.space.id, name: r.space.name } : null,
			path: allSpaces ? pathOf(allSpaces, r.spaceId) : undefined,
			imageUrl: r.imageUrl,
			updatedAt: r.updatedAt,
		};
  }

	/** 关键词对 name/brand/model/category/description 五字段模糊匹配。
	 * 大小写不敏感靠 PG 的 mode:'insensitive'（schema.prisma 的 provider 必须是 postgresql，
	 * 见 09-21 事故：provider 被误提交成 sqlite 会让后端起不来）。 */
	private keywordWhere(keyword?: string): Prisma.ItemWhereInput {
		const kw = (keyword || '').trim();
		if (!kw) return {};
		const contains = (k: string) => ({ contains: k, mode: 'insensitive' as const });
		return {
			OR: [
				{ name: contains(kw) },
				{ brand: contains(kw) },
				{ model: contains(kw) },
				{ category: contains(kw) },
				{ description: contains(kw) },
			],
		};
	}


	async list(userId: string, q: QueryItemsDto) {
		const page = q.page || 1;
		const pageSize = q.pageSize || 20;
		const where: Prisma.ItemWhereInput = { userId, deletedAt: null, ...this.keywordWhere(q.keyword) };
		if (q.spaceId) where.spaceId = q.spaceId;
		// 分类 chips 的精确筛选（契约 v1.4）：等值匹配，不走 keyword 模糊，计数与列表口径一致
		if (q.category) where.category = q.category;

    const [total, rows, allSpaces] = await this.prisma.$transaction([
      this.prisma.item.count({ where }),
      this.prisma.item.findMany({
        where,
        include: itemInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.space.findMany({ where: { userId } }),
    ]);
    return { total, page, pageSize, items: rows.map((r) => this.toCard(r, allSpaces)) };
  }

	async create(userId: string, dto: CreateItemDto) {
		await this.prisma.ensureUser(userId);
		const spaceId = dto.spaceId ? await this.assertSpace(userId, dto.spaceId) : undefined;

    const data: Prisma.ItemCreateInput = {
      user: { connect: { id: userId } },
      name: dto.name,
      quantity: dto.quantity ?? 1,
    };
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.brand !== undefined) data.brand = dto.brand;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (spaceId) data.space = { connect: { id: spaceId } };
    if (dto.tags && dto.tags.length) data.tags = { create: this.tagOps(userId, dto.tags) };

    const item = await this.prisma.item.create({ data, include: itemInclude });

    // AIResult 回填（契约 v1.2）：只回填「本人且尚未关联物品」的记录。
    // C14：where 必须带 userId —— 少了它，任何人拿别人的 aiResultId 调 POST /items
    // 就能把别人的识别记录挂到自己物品上，详情页随之读到别人的内容（跨用户越权）。
    if (dto.aiResultId) {
      await this.prisma.aIResult.updateMany({
        where: { id: dto.aiResultId, itemId: null, userId },
        data: { itemId: item.id },
      });
    }
    return this.toCard(item);
  }

  async detail(userId: string, id: string) {
    const r = await this.prisma.item.findFirst({
      where: { id, userId, deletedAt: null },
      // C14 双保险：识别记录本身也按归属过滤，历史脏数据里被抢占的挂链不会出现在详情页
      include: {
        ...itemInclude,
        aiResults: { where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!r) throw new NotFoundException('物品不存在');
    return {
      ...this.toCard(r),
      description: r.description,
      quantity: r.quantity,
      status: r.status,
      aiResults: r.aiResults.map((a) => {
        let result: unknown = a.resultJson;
        try { result = JSON.parse(a.resultJson); } catch { /* 保持原文 */ }
        return { id: a.id, taskType: a.taskType, model: a.model, result, createdAt: a.createdAt };
      }),
    };
  }

	async update(userId: string, id: string, dto: UpdateItemDto) {
		const existing = await this.prisma.item.findFirst({ where: { id, userId, deletedAt: null } });
		if (!existing) throw new NotFoundException('物品不存在');
		const spaceField = await this.spaceFieldForUpdate(userId, dto.spaceId);

		const data: Prisma.ItemUpdateInput = {};
		if (dto.name !== undefined) data.name = dto.name;
		if (dto.category !== undefined) data.category = dto.category;
		if (dto.brand !== undefined) data.brand = dto.brand;
		if (dto.model !== undefined) data.model = dto.model;
		if (dto.color !== undefined) data.color = dto.color;
		if (dto.description !== undefined) data.description = dto.description;
		if (dto.quantity !== undefined) data.quantity = dto.quantity;
		if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
		if (spaceField) data.space = spaceField;

    // tags 整体替换：先解绑旧标签再绑定新标签，事务保证一致性（方案文档第二十二节）
    const item = await this.prisma.$transaction(async (tx) => {
      if (dto.tags) await tx.itemTag.deleteMany({ where: { itemId: id } });
      if (dto.tags) data.tags = { create: this.tagOps(userId, dto.tags) };
      return tx.item.update({ where: { id }, data, include: itemInclude });
    });
    return this.toCard(item);
  }

  /** 软删除：deletedAt 置时间；已删除再删返回 404（幂等由前端以"不存在即成功"处理） */
  async remove(userId: string, id: string) {
    const existing = await this.prisma.item.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('物品不存在');
    await this.prisma.item.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  /** 分类筛选 chips：当前用户物品按 category 分组计数（排除软删除），按数量倒序 */
  async categories(userId: string) {
    const rows = await this.prisma.item.groupBy({
      by: ['category'],
      where: { userId, deletedAt: null, category: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
    });
    return { categories: rows.map((r) => ({ name: r.category as string, count: r._count._all })) };
  }

  /** 同类物品：同分类或标签交集，≤5 件，排除自身（契约 2.2） */
  async related(userId: string, id: string) {
    const self = await this.prisma.item.findFirst({
      where: { id, userId, deletedAt: null },
      include: { tags: { include: { tag: true } } },
    });
    if (!self) throw new NotFoundException('物品不存在');

    const or: Prisma.ItemWhereInput[] = [];
    if (self.category) or.push({ category: self.category });
    const tagIds = self.tags.map((t) => t.tagId);
    if (tagIds.length) or.push({ tags: { some: { tagId: { in: tagIds } } } });
    if (!or.length) return { items: [] };

    const allSpaces = await this.prisma.space.findMany({ where: { userId } });
    const rows = await this.prisma.item.findMany({
      where: { userId, deletedAt: null, id: { not: id }, OR: or },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        brand: r.brand,
        model: r.model,
        category: r.category,
        tags: r.tags.map((t) => t.tag.name),
        path: pathOf(allSpaces, r.spaceId),
        imageUrl: r.imageUrl,
      })),
    };
  }
}
