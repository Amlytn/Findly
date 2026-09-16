/**
 * @author james-wu66
 * SpacesService 单元测试：环检测 + 删除保护
 * Prisma 全部 mock，不连数据库
 */
import { BadRequestException } from '@nestjs/common';
import { SpacesService } from '../src/spaces/spaces.service';

describe('SpacesService', () => {
  let service: SpacesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      space: {
        findFirst: jest.fn(),
        count: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      item: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new SpacesService(prisma);
  });

  /** 造一棵 A → B → C 的树（A 为根） */
  const tree = {
    A: { id: 'A', parentId: null },
    B: { id: 'B', parentId: 'A' },
    C: { id: 'C', parentId: 'B' },
  };

  const mockByTree = () => {
    prisma.space.findFirst.mockImplementation((args: any) =>
      Promise.resolve(tree[args?.where?.id] ?? null),
    );
  };

  // ⑥ 环检测
  describe('⑥ 环检测', () => {
    it('把 A 挪到自己的子孙 C 之下 → 400（会形成环）', async () => {
      mockByTree();
      await expect(service.update('u1', 'A', { parentId: 'C' } as any)).rejects.toThrow(
        '不能移动到自己的子空间下（会形成环）',
      );
    });

    it('把自己设为自己的父级 → 400', async () => {
      mockByTree();
      await expect(service.update('u1', 'A', { parentId: 'A' } as any)).rejects.toThrow(
        '不能把自己设为父级',
      );
    });

    it('目标父空间不存在/不属于本人 → 400', async () => {
      prisma.space.findFirst.mockImplementation((args: any) =>
        Promise.resolve(args?.where?.id === 'A' ? tree.A : null),
      );
      await expect(service.update('u1', 'A', { parentId: 'ghost' } as any)).rejects.toThrow(
        '目标父空间不存在或不属于当前用户',
      );
    });

    it('合法挪动（A 挪到兄弟节点下这种不成环的情况）不报错', async () => {
      const rows: Record<string, any> = {
        A: { id: 'A', parentId: null },
        X: { id: 'X', parentId: null },
      };
      prisma.space.findFirst.mockImplementation((args: any) =>
        Promise.resolve(rows[args?.where?.id] ?? null),
      );
      prisma.space.update = jest.fn().mockResolvedValue({ id: 'A' });
      await expect(service.update('u1', 'A', { parentId: 'X' } as any)).resolves.toBeDefined();
    });
  });

  // ⑦ 删除保护
  describe('⑦ 删除保护', () => {
    it('存在子空间时拒绝删除 → 400，且不执行 delete', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 'A' });
      prisma.space.count.mockResolvedValue(2);
      await expect(service.remove('u1', 'A')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.space.delete).not.toHaveBeenCalled();
    });

    it('有未删除物品时拒绝删除 → 400', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 'A' });
      prisma.space.count.mockResolvedValue(0);
      prisma.item.count.mockResolvedValue(3);
      await expect(service.remove('u1', 'A')).rejects.toThrow('该空间下有 3 件物品');
      expect(prisma.space.delete).not.toHaveBeenCalled();
    });

    it('无子空间且无物品时才真正删除', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 'A' });
      prisma.space.count.mockResolvedValue(0);
      prisma.item.count.mockResolvedValue(0);
      await expect(service.remove('u1', 'A')).resolves.toEqual({ ok: true });
      expect(prisma.space.delete).toHaveBeenCalledWith({ where: { id: 'A' } });
    });
  });
});
