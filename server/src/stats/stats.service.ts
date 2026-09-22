/**
 * @author james-wu66
 * Findly 后端 · 2026-09-17（B02：用量统计）· 2026-09-22（C09/C07/C08 修正）
 *
 * 聚合 AIResult 表，输出 AI 调用的次数 / token / 估算成本 / 降级率 / 缓存命中率。
 *
 * ⚠️ 单价表（PRICE_PER_M）与 docs/验证脚本/usage.cjs 是两份拷贝，**改价必须同步改**，
 *    否则同一笔调用的成本两边算出来不一样。
 *    但**默认统计范围本来就不同**，不要拿总数直接对比：本接口＝当前用户全部记录；
 *    脚本默认＝全平台全部记录。要同口径对比用 `node usage.cjs --user=<id>`
 *    （2026-09-22 交叉验证：--user=dev 与本接口同为 1 次 / 87 tokens / ¥0.000031）。
 *
 * 三条口径修正：
 *  - C09 只统计调用者自己的记录（此前 AIResult 无 userId，接口返回全平台聚合，
 *    任何登录用户可看他人用量与成本）；
 *  - C07 缓存命中率的**分母只算 recognize**（缓存只存在于识图链路，把 parse-query
 *    混进分母会被系统性稀释，命中率永远偏低）；
 *  - C08 支持可选 days 时间范围（此前无任何过滤地把整张表读进内存逐行 parse）。
 * 另外如实报出**无归属的历史记录数**（unattributed），避免"数字怎么变小了"无从解释。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 模型单价（元 / 100 万 token） */
const PRICE_PER_M: Record<string, { input: number; output: number }> = {
  'qwen-vl-plus': { input: 8, output: 2 },
  'qwen-turbo': { input: 0.3, output: 0.6 },
};

/** 缓存只用于识图链路，故命中率按这一 taskType 计算 */
const CACHE_TASK_TYPE = 'recognize';

interface TypeAgg {
  calls: number;
  tokens: number;
  cost: number;
}

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  /** @param days 可选，只统计最近 N 天；缺省为全部（向后兼容既有调用方） */
  async overview(userId: string, days?: number) {
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
    const range = since ? { createdAt: { gte: since } } : {};

    const [rows, unattributed] = await Promise.all([
      this.prisma.aIResult.findMany({
        where: { userId, ...range }, // C09：归属过滤；命中 AIResult_userId_idx
        select: { taskType: true, model: true, resultJson: true },
      }),
      // 迁移只回填了能经 Item 反查出归属的历史行；识别后未保存物品的无从判定，留 null
      this.prisma.aIResult.count({ where: { userId: null, ...range } }),
    ]);

    const byType = new Map<string, TypeAgg>();
    let totalTokens = 0;
    let totalCost = 0;
    let degraded = 0;
    let cacheHit = 0;

    for (const row of rows) {
      // 单条 resultJson 损坏不能让整个接口挂掉，解析失败按"只有次数、没有用量"处理
      let payload: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(row.resultJson);
        if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
      } catch {
        /* 保持空对象 */
      }

      const usage = (payload.usage ?? null) as Record<string, unknown> | null;
      const tokens = typeof usage?.total_tokens === 'number' ? usage.total_tokens : 0;
      const cost = this.costOf(row.model, usage);
      const isDegraded = String(payload.source ?? '').includes('降级');
      const isCached = payload.cached === true;

      const agg = byType.get(row.taskType) ?? { calls: 0, tokens: 0, cost: 0 };
      agg.calls += 1;
      agg.tokens += tokens;
      agg.cost += cost;
      byType.set(row.taskType, agg);

      totalTokens += tokens;
      totalCost += cost;
      if (isDegraded) degraded += 1;
      if (isCached) cacheHit += 1;
    }

    const totalCalls = rows.length;
    const cacheableCalls = byType.get(CACHE_TASK_TYPE)?.calls ?? 0;
    return {
      totalCalls,
      totalTokens,
      estimatedCost: round(totalCost, 6),
      currency: 'CNY',
      // 无记录时给 0，避免出现 NaN
      degradedRate: totalCalls ? round(degraded / totalCalls, 4) : 0,
      // C07：分母只含可被缓存的 recognize 调用
      cacheHitRate: cacheableCalls ? round(cacheHit / cacheableCalls, 4) : 0,
      // 目前未记录每次调用耗时，无数据源（见 B02 提示词第五节）
      avgDurationMs: null as number | null,
      byTaskType: [...byType.entries()].map(([taskType, a]) => ({
        taskType,
        calls: a.calls,
        tokens: a.tokens,
        cost: round(a.cost, 6),
      })),
      // 以下两项为 C09/C07 引入的可解释性字段（新增字段，不改既有字段名）
      cacheHitDenominator: cacheableCalls,
      unattributed,
      rangeDays: days ?? null,
      generatedAt: new Date().toISOString(),
    };
  }

  /** 单价表查不到该模型时返回 0：token 照常计入，但不猜价格 */
  private costOf(model: string, usage: Record<string, unknown> | null): number {
    const price = PRICE_PER_M[model];
    if (!price || !usage) return 0;
    const input = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
    const output = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
    return (input / 1e6) * price.input + (output / 1e6) * price.output;
  }
}

function round(n: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(n * factor) / factor;
}
