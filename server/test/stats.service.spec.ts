/**
 * @author james-wu66
 * StatsService 单元测试（B02）
 *
 * 覆盖：空数据、成本计算、未知模型、降级率、缓存命中率、坏 JSON 容错、分组。
 * Prisma 全部 mock，不连数据库。
 */
import { StatsService } from '../src/stats/stats.service';

function mockPrisma(rows: any[]) {
  return {
    aIResult: { findMany: jest.fn().mockResolvedValue(rows) },
  } as any;
}

describe('StatsService', () => {
  describe('空数据', () => {
    it('没有任何记录时各计数为 0，且比率不是 NaN', async () => {
      const service = new StatsService(mockPrisma([]));
      const res: any = await service.overview();

      expect(res.totalCalls).toBe(0);
      expect(res.totalTokens).toBe(0);
      expect(res.estimatedCost).toBe(0);
      expect(res.degradedRate).toBe(0);
      expect(res.cacheHitRate).toBe(0);
      expect(Number.isNaN(res.degradedRate)).toBe(false);
      expect(Number.isNaN(res.cacheHitRate)).toBe(false);
      expect(res.byTaskType).toEqual([]);
    });
  });

  describe('成本计算（单价与 usage.cjs 保持一致）', () => {
    it('qwen-vl-plus：prompt 1000 / completion 500 → 0.009 元', async () => {
      // (1000/1e6)*8 + (500/1e6)*2 = 0.008 + 0.001
      const service = new StatsService(
        mockPrisma([
          {
            taskType: 'recognize',
            model: 'qwen-vl-plus',
            resultJson: JSON.stringify({
              usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
            }),
          },
        ]),
      );
      const res: any = await service.overview();
      expect(res.estimatedCost).toBeCloseTo(0.009, 6);
      expect(res.totalTokens).toBe(1500);
    });

    it('qwen-turbo：prompt 2000 / completion 1000 → 0.0012 元', async () => {
      // (2000/1e6)*0.3 + (1000/1e6)*0.6 = 0.0006 + 0.0006
      const service = new StatsService(
        mockPrisma([
          {
            taskType: 'parse-query',
            model: 'qwen-turbo',
            resultJson: JSON.stringify({
              usage: { prompt_tokens: 2000, completion_tokens: 1000, total_tokens: 3000 },
            }),
          },
        ]),
      );
      const res: any = await service.overview();
      expect(res.estimatedCost).toBeCloseTo(0.0012, 6);
    });

    it('两种模型混合时成本累加正确', async () => {
      const service = new StatsService(
        mockPrisma([
          {
            taskType: 'recognize',
            model: 'qwen-vl-plus',
            resultJson: JSON.stringify({
              usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
            }),
          },
          {
            taskType: 'parse-query',
            model: 'qwen-turbo',
            resultJson: JSON.stringify({
              usage: { prompt_tokens: 2000, completion_tokens: 1000, total_tokens: 3000 },
            }),
          },
        ]),
      );
      const res: any = await service.overview();
      expect(res.estimatedCost).toBeCloseTo(0.0102, 6); // 0.009 + 0.0012
      expect(res.totalTokens).toBe(4500);
      expect(res.totalCalls).toBe(2);
    });
  });

  describe('单价表查不到的模型', () => {
    it('token 照常计入，但成本不计（不猜价格）', async () => {
      const service = new StatsService(
        mockPrisma([
          {
            taskType: 'recognize',
            model: 'some-unknown-model',
            resultJson: JSON.stringify({
              usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
            }),
          },
        ]),
      );
      const res: any = await service.overview();
      expect(res.totalTokens).toBe(1500);
      expect(res.estimatedCost).toBe(0);
    });
  });

  describe('降级率', () => {
    it('source 含「降级」的记录被计数', async () => {
      const service = new StatsService(
        mockPrisma([
          {
            taskType: 'parse-query',
            model: 'qwen-turbo',
            resultJson: JSON.stringify({ source: 'LLM 不可用，降级关键词直查', reason: 'HTTP 401' }),
          },
          {
            taskType: 'parse-query',
            model: 'qwen-turbo',
            resultJson: JSON.stringify({ source: 'LLM Query Parser' }),
          },
          {
            taskType: 'parse-query',
            model: 'qwen-turbo',
            resultJson: JSON.stringify({ source: 'LLM Query Parser' }),
          },
          {
            taskType: 'parse-query',
            model: 'qwen-turbo',
            resultJson: JSON.stringify({ source: 'LLM Query Parser' }),
          },
        ]),
      );
      const res: any = await service.overview();
      expect(res.degradedRate).toBe(0.25); // 1 / 4
    });
  });

  describe('缓存命中率', () => {
    it('C03 口径：命中记录 usage 为 null 时不贡献 token/成本，但仍计入命中率', async () => {
      const service = new StatsService(
        mockPrisma([
          {
            taskType: 'recognize',
            model: 'qwen-vl-plus',
            resultJson: JSON.stringify({
              usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
            }),
          },
          { taskType: 'recognize', model: 'qwen-vl-plus', resultJson: JSON.stringify({ cached: true, usage: null }) },
        ]),
      );
      const res: any = await service.overview();

      expect(res.totalCalls).toBe(2);
      expect(res.totalTokens).toBe(1500); // 命中那条不重复计，否则成本虚高
      expect(res.estimatedCost).toBeCloseTo(0.009, 6);
      expect(res.cacheHitRate).toBe(0.5); // 但命中率统计得到
    });
    it('cached:true 的记录被计数', async () => {
      const service = new StatsService(
        mockPrisma([
          { taskType: 'recognize', model: 'qwen-vl-plus', resultJson: JSON.stringify({ cached: true }) },
          { taskType: 'recognize', model: 'qwen-vl-plus', resultJson: JSON.stringify({ cached: true }) },
          { taskType: 'recognize', model: 'qwen-vl-plus', resultJson: JSON.stringify({}) },
          { taskType: 'recognize', model: 'qwen-vl-plus', resultJson: JSON.stringify({ cached: false }) },
        ]),
      );
      const res: any = await service.overview();
      expect(res.cacheHitRate).toBe(0.5); // 2 / 4
    });
  });

  describe('坏数据容错', () => {
    it('非法 JSON 不抛异常，且该条仍计入 totalCalls', async () => {
      const service = new StatsService(
        mockPrisma([
          { taskType: 'recognize', model: 'qwen-vl-plus', resultJson: '这不是 JSON' },
          {
            taskType: 'recognize',
            model: 'qwen-vl-plus',
            resultJson: JSON.stringify({
              usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
            }),
          },
        ]),
      );
      await expect(service.overview()).resolves.toBeDefined();
      const res: any = await service.overview();
      expect(res.totalCalls).toBe(2);
      expect(res.totalTokens).toBe(1500); // 坏的那条贡献 0
    });

    it('缺 usage 字段时 token 记 0，不报错', async () => {
      const service = new StatsService(
        mockPrisma([{ taskType: 'parse-query', model: 'qwen-turbo', resultJson: JSON.stringify({ keyword: '鼠标' }) }]),
      );
      const res: any = await service.overview();
      expect(res.totalTokens).toBe(0);
      expect(res.estimatedCost).toBe(0);
      expect(res.totalCalls).toBe(1);
    });
  });

  describe('按 taskType 分组', () => {
    it('分组次数与 token 正确', async () => {
      const service = new StatsService(
        mockPrisma([
          {
            taskType: 'recognize',
            model: 'qwen-vl-plus',
            resultJson: JSON.stringify({ usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 } }),
          },
          {
            taskType: 'recognize',
            model: 'qwen-vl-plus',
            resultJson: JSON.stringify({ usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 } }),
          },
          {
            taskType: 'parse-query',
            model: 'qwen-turbo',
            resultJson: JSON.stringify({ usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } }),
          },
        ]),
      );
      const res: any = await service.overview();
      const recognize = res.byTaskType.find((t: any) => t.taskType === 'recognize');
      const parseQuery = res.byTaskType.find((t: any) => t.taskType === 'parse-query');

      expect(recognize.calls).toBe(2);
      expect(recognize.tokens).toBe(3000);
      expect(recognize.cost).toBeCloseTo(0.018, 6);
      expect(parseQuery.calls).toBe(1);
      expect(parseQuery.tokens).toBe(150);
    });
  });

  describe('契约字段', () => {
    it('currency / generatedAt / avgDurationMs 符合契约', async () => {
      const service = new StatsService(mockPrisma([]));
      const res: any = await service.overview();

      expect(res.currency).toBe('CNY');
      expect(res.avgDurationMs).toBeNull(); // 无耗时数据源，固定 null
      expect(typeof res.generatedAt).toBe('string');
      expect(new Date(res.generatedAt).toString()).not.toBe('Invalid Date');
    });

    it('返回的字段集合与契约一致', async () => {
      const service = new StatsService(mockPrisma([]));
      const res: any = await service.overview();
      expect(Object.keys(res).sort()).toEqual(
        [
          'avgDurationMs',
          'byTaskType',
          'cacheHitRate',
          'currency',
          'degradedRate',
          'estimatedCost',
          'generatedAt',
          'totalCalls',
          'totalTokens',
        ].sort(),
      );
    });
  });
});
