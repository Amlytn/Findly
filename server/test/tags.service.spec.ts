/**
 * @author james-wu66
 * C15：标签去重（ItemsService.tagOps）
 * 单独成文件的原因：两个分支都往 items.service.spec.ts 末尾追加 describe 会撞同一锚点，
 * 挪出来让 C14 与 C15 两个 PR 各自干净可合，不必约定合并顺序。
 * Prisma 全部 mock，不连数据库
 */
import { ItemsService } from '../src/items/items.service';

describe('C15 tags 先去重再落库', () => {
  let service: ItemsService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      itemTag: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      item: {
        update: jest.fn().mockResolvedValue({ id: 'i1', tags: [], space: null, spaceId: null }),
      },
    };
    prisma = {
      item: { findFirst: jest.fn().mockResolvedValue({ id: 'i1' }) },
      space: { findFirst: jest.fn().mockResolvedValue({ id: 's9' }) },
      $transaction: jest.fn((cb: any) => (typeof cb === 'function' ? cb(tx) : Promise.all(cb))),
    };
    service = new ItemsService(prisma);
  });

  /** 取本次事务里最终传给 item.update 的 tags.create */
  const created = () => tx.item.update.mock.calls[0][0].data.tags.create;

  it('同名（含 trim 后同名）只绑定一次，顺序按首次出现', async () => {
    await service.update('u1', 'i1', { tags: ['鼠标', '鼠标', ' 鼠标 ', '键盘'] } as any);
    expect(created().map((c: any) => c.tag.connectOrCreate.create)).toEqual([
      { userId: 'u1', name: '鼠标' },
      { userId: 'u1', name: '键盘' },
    ]);
  });

  it('全是空串/空白时绑定空数组，不报错也不写脏标签', async () => {
    await service.update('u1', 'i1', { tags: ['', '   '] } as any);
    expect(created()).toEqual([]);
  });

  it('去重发生在落库之前（否则同一 (itemId,tagId) 主键插两次 → P2002 → 500）', async () => {
    await service.update('u1', 'i1', { tags: ['a', 'a', 'a'] } as any);
    expect(created()).toHaveLength(1);
  });
});
