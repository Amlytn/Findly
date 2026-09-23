/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_SPACE_DEPTH } from '../common/path.util';
import { CreateSpaceDto, UpdateSpaceDto } from './dto';

type SpaceRow = { id: string; parentId: string | null; name: string; type: string | null; icon: string | null; sortOrder: number };
type SpaceNode = {
  id: string;
  parentId: string | null;
  name: string;
  type: string | null;
  icon: string | null;
  sortOrder: number;
  itemCount: number;
  children: SpaceNode[];
};

@Injectable()
export class SpacesService {
  constructor(private prisma: PrismaService) {}

  private async assertOwned(userId: string, id: string, message = '空间不存在') {
    const space = await this.prisma.space.findFirst({ where: { id, userId } });
    if (!space) throw new NotFoundException(message);
    return space;
  }

  /** C21：把"环检测"和"深度校验"合成一次向上回溯，两件事共用同一条父链。
   *
   * 改前两处各写各的：assertNoCycle 回溯 50 步、pathOf 只回溯 20 步 ⇒
   * ① 20~50 层之间路径被静默截断（实测 25 层链只拼出 20 段，且没有省略号提示）；
   * ② 超过 50 层的链，assertNoCycle 走完 50 步就 return，**成环漏判**
   *    （实测 60 层链把链顶挪到链底，原来不报错，等于真能写出环）。
   * 现在写入时就按 MAX_SPACE_DEPTH 拦住，正常数据进不到那个深度，两种情况一起消失。
   *
   * 顺带把回溯改成"一次 findMany + 内存走链"：原来每步一次 findFirst，最深要打 50 次库。
   * @param id 被挪动的空间 id；create 场景传 null（还没有自己，不可能成环）
   */
  private async assertPlacement(userId: string, id: string | null, parentId: string) {
    if (id && id === parentId) throw new BadRequestException('不能把自己设为父级');
    const all = await this.prisma.space.findMany({ where: { userId }, select: { id: true, parentId: true } });
    const byId = new Map(all.map((s: any) => [s.id, s]));
    const parent = byId.get(parentId);
    if (!parent) throw new BadRequestException('目标父空间不存在或不属于当前用户');

    let depth = 1; // parentId 自己所在的层级（根算第 1 层）
    let cur = parent;
    while (cur.parentId) {
      const next: any = byId.get(cur.parentId);
      if (!next) break; // 父链指向不在本人空间集内的行（脏数据），链到此为止
      if (id && next.id === id) throw new BadRequestException('不能移动到自己的子空间下（会形成环）');
      cur = next;
      depth++;
      // 链本身就超深（或成环走不完）：当场掐断，绝不静默放过
      if (depth > MAX_SPACE_DEPTH) throw new BadRequestException(`空间层级最多 ${MAX_SPACE_DEPTH} 层`);
    }
    // 新节点落在第 depth+1 层。这一句必须写在循环外：
    // 父级正好在第 20 层时循环会因 cur 到根而正常退出，写在循环内会漏判那一层。
    if (depth + 1 > MAX_SPACE_DEPTH) {
      throw new BadRequestException(`空间层级最多 ${MAX_SPACE_DEPTH} 层，当前父级已在第 ${depth} 层`);
    }
  }

  /** list 平铺 + tree 组装；itemCount 一次 groupBy 合并，避免 N+1（契约 1） */
  async list(userId: string) {
    const spaces = (await this.prisma.space.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })) as SpaceRow[];

    const counts = await this.prisma.item.groupBy({
      by: ['spaceId'],
      where: { userId, deletedAt: null, spaceId: { in: spaces.map((s) => s.id) } },
      _count: { _all: true },
    });
    const countMap = new Map<string, number>(
      counts.map((c) => [c.spaceId as string, c._count._all]),
    );

    const nodes = new Map<string, SpaceNode>();
    for (const s of spaces) {
      nodes.set(s.id, {
        id: s.id,
        parentId: s.parentId,
        name: s.name,
        type: s.type,
        icon: s.icon,
        sortOrder: s.sortOrder,
        itemCount: countMap.get(s.id) || 0,
        children: [],
      });
    }
    const list = spaces.map((s) => nodes.get(s.id) as SpaceNode);
    const tree: SpaceNode[] = [];
    for (const s of spaces) {
      const node = nodes.get(s.id) as SpaceNode;
      const parent = s.parentId ? nodes.get(s.parentId) : undefined;
      if (parent) parent.children.push(node);
      else tree.push(node);
    }
    return { list, tree };
  }

  async create(userId: string, dto: CreateSpaceDto) {
    await this.prisma.ensureUser(userId);
    if (dto.parentId) {
      // 先按原语义查存在性（不存在 = 404，与 update 的 400 有意不同，前端依赖这个区别）
      await this.assertOwned(userId, dto.parentId, '父空间不存在或不属于当前用户');
      // C21：创建时也要卡深度（原来只有 update 做环检测，create 连深度都不看）
      await this.assertPlacement(userId, null, dto.parentId);
    }
    const data: any = { user: { connect: { id: userId } }, name: dto.name };
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.parentId) data.parent = { connect: { id: dto.parentId } };
    return this.prisma.space.create({ data });
  }

	async update(userId: string, id: string, dto: UpdateSpaceDto) {
		await this.assertOwned(userId, id);
		if (dto.parentId) await this.assertPlacement(userId, id, dto.parentId);

		const data: any = {};
		if (dto.name !== undefined) data.name = dto.name;
		if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
		// type 显式 null 时回退为 null 由前端兜底匹配；undefined = 不动
		if (dto.type !== undefined) data.type = dto.type;
		// icon 显式 null 表示清除用户选择，回退前端按名称匹配；undefined = 不动
		if (dto.icon !== undefined) data.icon = dto.icon;
		// parentId null/空串 = 移回根级（断开父级）；undefined = 不动
		if (dto.parentId === null || dto.parentId === '') {
			data.parent = { disconnect: true };
		} else if (dto.parentId !== undefined) {
			data.parent = { connect: { id: dto.parentId } };
		}
		return this.prisma.space.update({ where: { id }, data });
	}

  /** 删除保护：有子空间或有未删物品时拒绝（契约 1，返回 400） */
  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    const children = await this.prisma.space.count({ where: { parentId: id } });
    if (children > 0) throw new BadRequestException('该空间下有子空间，请先删除或移走子空间');
    const items = await this.prisma.item.count({ where: { spaceId: id, userId, deletedAt: null } });
    if (items > 0) throw new BadRequestException(`该空间下有 ${items} 件物品，请先移走或删除物品`);
    await this.prisma.space.delete({ where: { id } });
    return { ok: true };
  }
}
