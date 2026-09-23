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
      ensureUser: jest.fn().mockResolvedValue({}),
      space: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
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
    prisma.space.findMany.mockResolvedValue(Object.values(tree));
  };

  /** 造 s1 → s2 → … → sN 的深链（s1 为根，sN 在第 N 层） */
  const chainOf = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: 's' + (i + 1), parentId: i === 0 ? null : 's' + i }));

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
      prisma.space.findMany.mockResolvedValue([tree.A]); // 集合里没有 ghost
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
      prisma.space.findMany.mockResolvedValue(Object.values(rows));
      prisma.space.update = jest.fn().mockResolvedValue({ id: 'A' });
      await expect(service.update('u1', 'A', { parentId: 'X' } as any)).resolves.toBeDefined();
    });
  });

  // C21：环检测回溯 50 步、拼路径只回溯 20 步 ⇒ 两个数不一致的两个后果
  describe('C21 深度上限与环检测取齐为一个常量', () => {
    it('60 层深链把链顶挪到链底（真成环）→ 必须被拒（改前走完 50 步静默放过）', async () => {
      const chain = chainOf(60);
      prisma.space.findFirst.mockResolvedValue({ id: 's1', parentId: null });
      prisma.space.findMany.mockResolvedValue(chain);
      await expect(service.update('u1', 's1', { parentId: 's60' } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('父级已在第 20 层时再建子空间 → 400（新节点会落在第 21 层）', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 's20' });
      prisma.space.findMany.mockResolvedValue(chainOf(20));
      prisma.space.create = jest.fn();
      await expect(service.create('u1', { name: '第21层', parentId: 's20' } as any)).rejects.toThrow(
        /空间层级最多 20 层/,
      );
      expect(prisma.space.create).not.toHaveBeenCalled();
    });

    it('边界：父级在第 19 层时允许（新节点正好第 20 层，不许多也不许多一层）', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 's19' });
      prisma.space.findMany.mockResolvedValue(chainOf(19));
      prisma.space.create = jest.fn().mockResolvedValue({ id: 'new' });
      await expect(
        service.create('u1', { name: '第20层', parentId: 's19' } as any),
      ).resolves.toEqual({ id: 'new' });
    });

    it('回溯改为一次 findMany 走内存链（原来最深要打 50 次库）', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: 's1' });
      prisma.space.findMany.mockResolvedValue(chainOf(30));
      await service.update('u1', 's1', { parentId: 's30' } as any).catch(() => undefined);
      expect(prisma.space.findMany).toHaveBeenCalledTimes(1);
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
