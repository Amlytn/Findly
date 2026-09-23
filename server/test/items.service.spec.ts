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
      space: { findFirst: jest.fn() },
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

  // C15 重复标签：同一 name 出现两次会让 connectOrCreate 撞 (itemId,tagId) 主键 → P2002 → 500
  describe('C15 tags 先去重再落库', () => {
    it('同名（含 trim 后同名）只绑定一次，顺序按首次出现', async () => {
      await service.update('u1', 'i1', { tags: ['鼠标', '鼠标', ' 鼠标 ', '键盘'] } as any);
      const create = tx.item.update.mock.calls[0][0].data.tags.create;
      expect(create.map((c: any) => c.tag.connectOrCreate.create)).toEqual([
        { userId: 'u1', name: '鼠标' },
        { userId: 'u1', name: '键盘' },
      ]);
    });

    it('全是空串/空白时绑定空数组，不报错也不写脏标签', async () => {
      await service.update('u1', 'i1', { tags: ['', '   '] } as any);
      expect(tx.item.update.mock.calls[0][0].data.tags.create).toEqual([]);
    });
  });
});
