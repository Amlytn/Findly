/**
 * @author james-wu66
 * Findly 后端 · 2026-09-17（B02：用量统计）
 *
 * 聚合 AIResult 表，输出 AI 调用的次数 / token / 估算成本 / 降级率 / 缓存命中率。
 *
 * ⚠️ 成本算法（PRICE_PER_M 单价表）与 docs/验证脚本/usage.cjs 保持一致，
 *    两者必须同步修改，否则接口数字与命令行脚本会对不上。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 模型单价（元 / 100 万 token） */
const PRICE_PER_M: Record<string, { input: number; output: number }> = {
  'qwen-vl-plus': { input: 8, output: 2 },
  'qwen-turbo': { input: 0.3, output: 0.6 },
};

interface TypeAgg {
  calls: number;
  tokens: number;
  cost: number;
}

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const rows = await this.prisma.aIResult.findMany({
      select: { taskType: true, model: true, resultJson: true },
    });

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
    return {
      totalCalls,
      totalTokens,
      estimatedCost: round(totalCost, 6),
      currency: 'CNY',
      // 无记录时给 0，避免出现 NaN
      degradedRate: totalCalls ? round(degraded / totalCalls, 4) : 0,
      cacheHitRate: totalCalls ? round(cacheHit / totalCalls, 4) : 0,
      // 目前未记录每次调用耗时，无数据源（见 B02 提示词第五节）
      avgDurationMs: null as number | null,
      byTaskType: [...byType.entries()].map(([taskType, a]) => ({
        taskType,
        calls: a.calls,
        tokens: a.tokens,
        cost: round(a.cost, 6),
      })),
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
