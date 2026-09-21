/**
 * @author james-wu66
 * AiController 单元测试（C03：识别结果落库的 usage 口径）
 *
 * 这里是成本统计的实际写入点：缓存命中意味着本次零模型调用，落库的 usage 必须为 null，
 * 否则同一张图重复保存会把同一笔 token 反复累加，/stats 与 usage.cjs 全线虚高。
 * 同时锁定既有行为：aiResultId 仍返回（前端保存物品要回填）、description/tags 仍不落库。
 * AiService 与 Prisma 全部 mock，不联网、不连库。
 */
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { AiController } from '../src/ai/ai.controller';

const IMAGE = 'data:image/jpeg;base64,' + 'A'.repeat(128);
const USAGE = { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 };

function make(recognizeResult: any) {
  const ai = { recognize: jest.fn().mockResolvedValue(recognizeResult) } as any;
  const prisma = {
    ensureUser: jest.fn().mockResolvedValue(undefined),
    aIResult: { create: jest.fn().mockResolvedValue({ id: 'air_1' }) },
  } as any;
  const req = { headers: { 'x-user-id': 'dev' } };
  return { controller: new AiController(ai, prisma), ai, prisma, req };
}

/** 取落库时传给 prisma.aIResult.create 的 data（resultJson 已解析回对象） */
function savedRow(prisma: any) {
  const arg = prisma.aIResult.create.mock.calls[0][0];
  return { data: arg.data, payload: JSON.parse(arg.data.resultJson) };
}

describe('AiController.recognize', () => {
  it('真实调用模型：usage 原样落库，作为该次成本的数据源', async () => {
    const { controller, prisma, req } = make({
      result: { name: '鼠标', description: '长描述', tags: ['无线'], confidence: 0.9 },
      usage: USAGE,
    });

    await controller.recognize(req, { imageBase64: IMAGE } as any);

    const { data, payload } = savedRow(prisma);
    expect(data.taskType).toBe('recognize');
    expect(payload.usage).toEqual(USAGE);
    expect(payload.cached).toBeUndefined();
  });

  it('C03 核心：缓存命中时落库 usage 为 null，但 cached 标记与记录本身都要保留', async () => {
    const { controller, prisma, req } = make({
      result: { name: '鼠标', confidence: 0.9, cached: true },
      usage: null, // C03 修复后，服务层命中即返回 null
    });

    await controller.recognize(req, { imageBase64: IMAGE } as any);

    const { payload } = savedRow(prisma);
    expect(payload.usage).toBeNull();
    expect(payload.cached).toBe(true);
    expect(prisma.aIResult.create).toHaveBeenCalledTimes(1); // 仍落库：命中数要能被统计
  });

  it('命中记录不产生 token，同一张图识别两次合计只算一次的成本', async () => {
    const ai = {
      recognize: jest
        .fn()
        .mockResolvedValueOnce({ result: { name: '鼠标' }, usage: USAGE })
        .mockResolvedValueOnce({ result: { name: '鼠标', cached: true }, usage: null }),
    } as any;
    const rows: any[] = [];
    const prisma = {
      ensureUser: jest.fn().mockResolvedValue(undefined),
      aIResult: {
        create: jest.fn().mockImplementation(({ data }) => {
          rows.push(JSON.parse(data.resultJson));
          return Promise.resolve({ id: 'air_' + rows.length });
        }),
      },
    } as any;
    const req = { headers: { 'x-user-id': 'dev' } };
    const controller = new AiController(ai, prisma);

    await controller.recognize(req, { imageBase64: IMAGE } as any);
    await controller.recognize(req, { imageBase64: IMAGE } as any);

    const totalTokens = rows.reduce((s, r) => s + (r.usage?.total_tokens ?? 0), 0);
    expect(totalTokens).toBe(1200); // 不是 2400
    expect(rows.filter((r) => r.cached === true)).toHaveLength(1);
  });

  it('既有行为不回归：返回 aiResultId 供前端保存物品时回填', async () => {
    const { controller, req } = make({ result: { name: '鼠标' }, usage: USAGE });
    const res: any = await controller.recognize(req, { imageBase64: IMAGE } as any);

    expect(res.aiResultId).toBe('air_1');
    expect(res.name).toBe('鼠标');
  });

  it('既有行为不回归：description / tags 体积大的字段不落库', async () => {
    const { controller, prisma, req } = make({
      result: { name: '鼠标', description: 'x'.repeat(5000), tags: ['a', 'b'], confidence: 0.8 },
      usage: USAGE,
    });

    const res: any = await controller.recognize(req, { imageBase64: IMAGE } as any);
    const { payload } = savedRow(prisma);

    expect(res.description).toBe('x'.repeat(5000)); // 仍返回给前端
    expect(payload.description).toBeUndefined(); // 但不入库
    expect(payload.tags).toBeUndefined();
    expect(payload.name).toBe('鼠标');
  });

  it('入参守卫仍在：非图片 dataURL → 400', async () => {
    const { controller, req } = make({ result: {}, usage: null });
    await expect(
      controller.recognize(req, { imageBase64: 'data:application/pdf;base64,AAA' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('入参守卫仍在：超过 4MB → 413', async () => {
    const { controller, req, ai } = make({ result: {}, usage: null });
    const big = 'data:image/png;base64,' + 'A'.repeat(6 * 1024 * 1024);

    await expect(controller.recognize(req, { imageBase64: big } as any)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(ai.recognize).not.toHaveBeenCalled(); // 超限时不能先打模型
  });
});
