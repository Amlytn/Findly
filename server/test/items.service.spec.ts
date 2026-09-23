/**
 * @author james-wu66
 * ItemsService 单元测试：tags 整体替换的事务一致性 + spaceId 归属校验
 * Prisma 全部 mock，不连数据库
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ItemsService } from '../src/items/items.service';

describe('ItemsService', () => {
  let service: ItemsService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      itemTag: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      item: {
        update: jest.fn().mockResolvedValue({ id: 'i1', tags: [], space: null, spaceId: null }),
      },
    };
    prisma = {
      item: {
        findFirst: jest.fn().mockResolvedValue({ id: 'i1' }),
        update: jest.fn(),
      },
      space: {
        findFirst: jest.fn(),
        // C20 之后 create/update/detail 也要读全量空间来拼 path，缺这个 mock 会直接 TypeError
        findMany: jest.fn().mockResolvedValue([]),
      },
      // 模拟 Prisma 的交互式事务：把 mock 的事务客户端传进回调
      $transaction: jest.fn((cb: any) => (typeof cb === 'function' ? cb(tx) : Promise.all(cb))),
    };
    service = new ItemsService(prisma);
  });

  // ④ tags 整体替换必须落在同一个事务里
  describe('④ PATCH tags：先解绑再绑定，且在同一事务内', () => {
    it('传入 tags 时：事务内先 deleteMany 旧标签，再 update 绑定新标签', async () => {
      await service.update('u1', 'i1', { tags: ['新标签'] } as any);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.itemTag.deleteMany).toHaveBeenCalledWith({ where: { itemId: 'i1' } });
      expect(tx.item.update).toHaveBeenCalledTimes(1);

      const data = tx.item.update.mock.calls[0][0].data;
      expect(data.tags.create).toHaveLength(1);
      expect(data.tags.create[0].tag.connectOrCreate.create).toEqual({
        userId: 'u1',
        name: '新标签',
      });
    });

    it('事务外的 prisma.item.update 不应被调用（否则会脱离事务、破坏一致性）', async () => {
      await service.update('u1', 'i1', { tags: ['a', 'b'] } as any);
      expect(prisma.item.update).not.toHaveBeenCalled();
    });

    it('不传 tags 时不触碰标签关系（语义：不传即不动）', async () => {
      await service.update('u1', 'i1', { name: '改名' } as any);
      expect(tx.itemTag.deleteMany).not.toHaveBeenCalled();
      const data = tx.item.update.mock.calls[0][0].data;
      expect(data.tags).toBeUndefined();
    });

    it('物品不存在时抛 404，且不进事务', async () => {
      prisma.item.findFirst.mockResolvedValue(null);
      await expect(service.update('u1', 'nope', { name: 'x' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ⑤ spaceId 归属校验
  describe('⑤ spaceId 不属于当前用户 → 400', () => {
    it('归属校验查不到空间时抛 BadRequestException', async () => {
      prisma.space.findFirst.mockResolvedValue(null);
      await expect(
        service.update('u1', 'i1', { spaceId: 'someone-else-space' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('归属校验按「空间 id + 当前用户」查询（防越权）', async () => {
      prisma.space.findFirst.mockResolvedValue(null);
      await service.update('u1', 'i1', { spaceId: 's9' } as any).catch(() => undefined);
      expect(prisma.space.findFirst).toHaveBeenCalledWith({
        where: { id: 's9', userId: 'u1' },
      });
    });
  });

  // C14 识别记录归属：B 拿 A 的 aiResultId 不能把 A 的记录挂到自己物品上
  describe('C14 aiResultId 回填与详情装载必须带归属', () => {
    beforeEach(() => {
      prisma.ensureUser = jest.fn().mockResolvedValue(undefined);
      prisma.item.create = jest.fn().mockResolvedValue({ id: 'i-new', tags: [], space: null });
      prisma.aIResult = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    });

    it('回填 where 同时含 id / itemId: null / 当前 userId', async () => {
      await service.create('b', { name: 'B 的物品', aiResultId: 'air-of-a' } as any);
      expect(prisma.aIResult.updateMany).toHaveBeenCalledWith({
        where: { id: 'air-of-a', itemId: null, userId: 'b' },
        data: { itemId: 'i-new' },
      });
    });

    it('未传 aiResultId 时不做回填', async () => {
      await service.create('b', { name: '无识别记录' } as any);
      expect(prisma.aIResult.updateMany).not.toHaveBeenCalled();
    });

    it('详情装载 aiResults 时带 userId 过滤条件（双保险）', async () => {
      prisma.item.findFirst.mockResolvedValue({ id: 'i1', tags: [], aiResults: [] });
      await service.detail('u1', 'i1');
      const include = prisma.item.findFirst.mock.calls[0][0].include;
      expect(include.aiResults.where).toEqual({ userId: 'u1' });
    });
  });

  // C20：api.md 写的是"卡片统一含 path"，但 create/update/detail 三处都没传 allSpaces ⇒ 返回体缺 path
  describe('C20 三处返回体补齐完整位置路径', () => {
    const chain = [
      { id: 'sp1', parentId: null, name: '我的家' },
      { id: 'sp2', parentId: 'sp1', name: '书房' },
      { id: 'sp3', parentId: 'sp2', name: '书桌' },
    ];
    const row = (spaceId: string | null) => ({
      id: 'i1',
      name: '鼠标',
      brand: null,
      model: null,
      category: null,
      color: null,
      quantity: 1,
      status: 'normal',
      description: null,
      imageUrl: null,
      updatedAt: new Date(),
      spaceId,
      space: spaceId ? { id: spaceId, name: '书桌' } : null,
      tags: [],
      aiResults: [],
    });

    beforeEach(() => {
      prisma.ensureUser = jest.fn().mockResolvedValue({});
      prisma.space.findMany.mockResolvedValue(chain);
      prisma.item.create = jest.fn().mockResolvedValue(row('sp3'));
      prisma.item.findFirst.mockResolvedValue(row('sp3'));
      tx.item.update = jest.fn().mockResolvedValue(row('sp3'));
    });

    it('create 返回 path = 完整祖先链（不是只有直接父级）', async () => {
      const out: any = await service.create('u1', { name: '鼠标' } as any);
      expect(out.path).toBe('我的家 → 书房 → 书桌');
    });

    it('update 返回 path', async () => {
      const out: any = await service.update('u1', 'i1', { brand: '罗技' } as any);
      expect(out.path).toBe('我的家 → 书房 → 书桌');
    });

    it('detail 返回 path', async () => {
      const out: any = await service.detail('u1', 'i1');
      expect(out.path).toBe('我的家 → 书房 → 书桌');
    });

    it('未归位物品：path 是「未归位」，不是缺字段', async () => {
      prisma.item.create.mockResolvedValue(row(null));
      const out: any = await service.create('u1', { name: '桌上的U盘' } as any);
      expect(out.path).toBe('未归位');
      expect(out.space).toBeNull();
    });
  });
});
