/**
 * @author james-wu66
 * UploadService 单元测试（C10：孤儿图片清理的 24h 保护窗口）
 *
 * 覆盖：保护窗口内/外的判定、被引用文件（含软删除物品）永不删、dryRun 默认不删、
 * 真正删除与单文件失败容错、非图片忽略、目录不存在、stat 失败容错、契约字段。
 * 文件系统与 Prisma 全部 mock，绝不碰真实 uploads/ 目录。
 */
// 用 requireActual 兜底：只替换这 4 个函数，保留 fs 其余导出，
// 否则 Nest 依赖链上任何用到 fs 的模块在 require 阶段就会炸。
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn() }));
jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  readdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
}));

import { existsSync } from 'fs';
import { readdir, stat, unlink } from 'fs/promises';
import { UploadService } from '../src/upload/upload.service';

const HOUR = 60 * 60 * 1000;
const base = (p: unknown) => String(p).split(/[\\/]/).pop() as string;

function setup(opts: {
  dirExists?: boolean;
  files?: string[];
  /** 文件名 → 距上次修改的小时数；未列出的文件 stat 抛 ENOENT */
  ageHours?: Record<string, number>;
  /** 出现在 Item.imageUrl 上的路径集合（thumbnailUrl 一律 null） */
  referenced?: (string | null)[];
  /** unlink 对这些文件名抛错，模拟单文件删除失败 */
  unlinkFails?: string[];
}) {
  (existsSync as jest.Mock).mockReturnValue(opts.dirExists !== false);
  (readdir as jest.Mock).mockResolvedValue(opts.files ?? []);
  (stat as jest.Mock).mockImplementation(async (p: string) => {
    const h = opts.ageHours?.[base(p)];
    if (h === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return { mtimeMs: Date.now() - h * HOUR };
  });
  (unlink as jest.Mock).mockImplementation(async (p: string) => {
    if (opts.unlinkFails?.includes(base(p))) throw new Error('EBUSY');
  });

  const prisma: any = {
    item: {
      findMany: jest.fn().mockResolvedValue(
        (opts.referenced ?? []).map((url) => ({ imageUrl: url, thumbnailUrl: null })),
      ),
    },
  };
  return { service: new UploadService(prisma), prisma };
}

describe('UploadService.cleanOrphanImages', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('C10 · 24h 保护窗口', () => {
    it('上传 1 小时前的未引用图片不算孤儿（正在编辑的物品图片受保护）', async () => {
      const { service } = setup({
        files: ['fresh.png'],
        ageHours: { 'fresh.png': 1 },
      });
      const res = await service.cleanOrphanImages(false);

      expect(res.orphans).toEqual([]);
      expect(res.skippedRecent).toBe(1);
      expect(res.deleted).toBe(0);
      expect(unlink).not.toHaveBeenCalled();
    });

    it('23 小时 59 分仍在窗口内，不删', async () => {
      const { service } = setup({
        files: ['almost.png'],
        ageHours: { 'almost.png': 23.98 },
      });
      const res = await service.cleanOrphanImages(false);
      expect(res.orphans).toEqual([]);
      expect(res.skippedRecent).toBe(1);
    });

    it('超过 24 小时的未引用图片才判为孤儿', async () => {
      const { service } = setup({
        files: ['old.png'],
        ageHours: { 'old.png': 25 },
      });
      const res = await service.cleanOrphanImages(true);
      expect(res.orphans).toEqual(['old.png']);
      expect(res.skippedRecent).toBe(0);
    });

    it('窗口内外混合时只列超龄的，且各自计数不串', async () => {
      const { service } = setup({
        files: ['a-old.png', 'b-new.png', 'c-old.png', 'd-new.png'],
        ageHours: { 'a-old.png': 30, 'b-new.png': 2, 'c-old.png': 50, 'd-new.png': 23 },
      });
      const res = await service.cleanOrphanImages(true);

      expect(res.orphans).toEqual(['a-old.png', 'c-old.png']); // 孤儿名升序
      expect(res.skippedRecent).toBe(2);
      expect(res.scanned).toBe(4);
    });
  });

  describe('引用判定', () => {
    it('被物品引用的图片即使超过 24h 也不算孤儿', async () => {
      const { service } = setup({
        files: ['used.png'],
        ageHours: { 'used.png': 100 },
        referenced: ['/uploads/used.png'],
      });
      const res = await service.cleanOrphanImages(false);

      expect(res.orphans).toEqual([]);
      expect(res.referenced).toBe(1);
      expect(res.deleted).toBe(0);
    });

    it('取引用清单时不按 deletedAt 过滤（软删除物品的图片保守保留）', async () => {
      const { service, prisma } = setup({ files: [], referenced: [] });
      await service.cleanOrphanImages(true);

      const arg = prisma.item.findMany.mock.calls[0][0];
      expect(arg.where).toBeUndefined();
      expect(arg.select).toEqual({ imageUrl: true, thumbnailUrl: true });
    });

    it('非图片扩展名不参与清理', async () => {
      const { service } = setup({
        files: ['note.txt', 'data.json', 'old.png'],
        ageHours: { 'old.png': 48 },
      });
      const res = await service.cleanOrphanImages(false);

      expect(res.scanned).toBe(1);
      expect(res.orphans).toEqual(['old.png']);
      expect(unlink).toHaveBeenCalledTimes(1);
    });
  });

  describe('dryRun 语义', () => {
    it('缺省即 dryRun，只报告不删', async () => {
      const { service } = setup({ files: ['old.png'], ageHours: { 'old.png': 48 } });
      const res = await service.cleanOrphanImages();

      expect(res.dryRun).toBe(true);
      expect(res.orphans).toEqual(['old.png']);
      expect(res.deleted).toBe(0);
      expect(unlink).not.toHaveBeenCalled();
    });

    it('dryRun:false 真删，单个文件删除失败不影响其余', async () => {
      const { service } = setup({
        files: ['ok1.png', 'busy.png', 'ok2.png'],
        ageHours: { 'ok1.png': 30, 'busy.png': 30, 'ok2.png': 30 },
        unlinkFails: ['busy.png'],
      });
      const res = await service.cleanOrphanImages(false);

      expect(res.orphans).toEqual(['busy.png', 'ok1.png', 'ok2.png']);
      expect(res.deleted).toBe(2);
      expect(res.dryRun).toBe(false);
    });
  });

  describe('容错与契约字段', () => {
    it('uploads/ 目录不存在时返回全 0，且不读目录', async () => {
      const { service } = setup({ dirExists: false });
      const res = await service.cleanOrphanImages(false);

      expect(res).toEqual({
        scanned: 0,
        referenced: 0,
        orphans: [],
        skippedRecent: 0,
        graceHours: 24,
        deleted: 0,
        dryRun: false,
      });
      expect(readdir).not.toHaveBeenCalled();
    });

    it('stat 失败（文件刚消失）静默跳过，整个请求不挂', async () => {
      const { service } = setup({ files: ['gone.png', 'old.png'], ageHours: { 'old.png': 30 } });
      const res = await service.cleanOrphanImages(false);

      expect(res.orphans).toEqual(['old.png']);
      expect(res.deleted).toBe(1);
    });

    it('响应字段集合与契约 v1.5 一致', async () => {
      const { service } = setup({ files: [] });
      const res = await service.cleanOrphanImages(true);

      expect(Object.keys(res).sort()).toEqual(
        [
          'deleted',
          'dryRun',
          'graceHours',
          'orphans',
          'referenced',
          'scanned',
          'skippedRecent',
        ].sort(),
      );
      expect(res.graceHours).toBe(24);
    });
  });
});
