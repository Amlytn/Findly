/**
 * @author james-wu66
 * 更新/创建类 DTO 的 name 规则（C16：空名字曾被静默写入）
 * 走 plainToInstance + validate，与全局 ValidationPipe 的次序一致：
 * @TrimmedName 只在 class-transformer 阶段生效，直接 validate 裸对象是测不出 trim 的。
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateItemDto, UpdateItemDto } from '../src/items/dto';
import { UpdateSpaceDto } from '../src/spaces/dto';

async function check(cls: new () => any, payload: object) {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance);
  return {
    invalid: errors.filter((e) => Object.keys(e.constraints || {}).length > 0).map((e) => e.property),
    value: instance.name,
  };
}

describe('C16 name 不能为空（创建与更新同规则）', () => {
  it('UpdateItemDto：name 空串 → 不通过（此前 PATCH 返回 200 并把名字清空，物品从此搜不到）', async () => {
    expect((await check(UpdateItemDto, { name: '' })).invalid).toContain('name');
  });

  it('UpdateItemDto：纯空白 → 先 trim 成空串，同样不通过', async () => {
    expect((await check(UpdateItemDto, { name: '   ' })).invalid).toContain('name');
  });

  it('UpdateItemDto：不传 name 仍然通过（"不传即不动"的语义不能改）', async () => {
    expect((await check(UpdateItemDto, { brand: '罗技' })).invalid).toEqual([]);
  });

  it('CreateItemDto：同一规则，且两侧都按 trim 后的值入库', async () => {
    expect((await check(CreateItemDto, { name: '  ' })).invalid).toContain('name');
    const r = await check(CreateItemDto, { name: '  鼠标  ' });
    expect(r.invalid).toEqual([]);
    expect(r.value).toBe('鼠标');
  });

  it('UpdateSpaceDto：同一规则（空名会毁掉位置路径）', async () => {
    expect((await check(UpdateSpaceDto, { name: '' })).invalid).toContain('name');
    expect((await check(UpdateSpaceDto, { sortOrder: 3 })).invalid).toEqual([]);
  });
});
