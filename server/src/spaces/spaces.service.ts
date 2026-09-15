/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceDto, UpdateSpaceDto } from './dto';

type SpaceRow = { id: string; parentId: string | null; name: string; sortOrder: number };
type SpaceNode = {
  id: string;
  parentId: string | null;
  name: string;
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

  /** 环检测：把 id 挪到 newParentId 之下时，沿新父链向上回溯，遇到自己即成环 */
  private async assertNoCycle(userId: string, id: string, newParentId: string) {
    if (newParentId === id) throw new BadRequestException('不能把自己设为父级');
    let cur = await this.prisma.space.findFirst({ where: { id: newParentId, userId } });
    if (!cur) throw new BadRequestException('目标父空间不存在或不属于当前用户');
    let guard = 0;
    while (cur && guard++ < 50) {
      if (cur.id === id) throw new BadRequestException('不能移动到自己的子空间下（会形成环）');
      cur = cur.parentId
        ? await this.prisma.space.findFirst({ where: { id: cur.parentId, userId } })
        : null;
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
    if (dto.parentId) await this.assertOwned(userId, dto.parentId, '父空间不存在或不属于当前用户');
    const data: any = { user: { connect: { id: userId } }, name: dto.name };
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.parentId) data.parent = { connect: { id: dto.parentId } };
    return this.prisma.space.create({ data });
  }

  async update(userId: string, id: string, dto: UpdateSpaceDto) {
    await this.assertOwned(userId, id);
    if (dto.parentId) await this.assertNoCycle(userId, id, dto.parentId);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.parentId) data.parent = { connect: { id: dto.parentId } };
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
