/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { pathOf } from '../common/path.util';

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  /** 解析搜索词：短词直查；长句走 LLM；LLM 不可用降级关键词（source 如实标注） */
  private async parseForSearch(q: string) {
    const isSimple = q.length <= 6 && !/在哪|哪里|什么颜色|帮我找|怎么找/.test(q);
    if (isSimple) {
      return { keyword: q, color: null, features: [], source: '关键词直查数据库' };
    }
    try {
      const parsed = await this.ai.parseQuery(q);
      // 查询解析落库 AIResult（与 recognize 一致）；source 写入 JSON 便于统计降级比例
      await this.prisma.aIResult.create({
        data: {
          taskType: 'parse-query',
          model: process.env.QWEN_TEXT_MODEL || 'qwen-turbo',
          resultJson: JSON.stringify({ ...parsed, source: 'LLM Query Parser' }),
        },
      });
      return { ...parsed, source: 'LLM Query Parser' };
    } catch (e) {
      // 降级路径也必须落库才能统计降级比例；根因（HTTP 401/网络错误等）写入 reason 供排障
      const reason = e?.message || '未知错误';
      try {
        await this.prisma.aIResult.create({
          data: {
            taskType: 'parse-query',
            model: process.env.QWEN_TEXT_MODEL || 'qwen-turbo',
            resultJson: JSON.stringify({ keyword: q, source: 'LLM 不可用，降级关键词直查', reason }),
          },
        });
      } catch {
        /* 日志失败不影响降级结果 */
      }
      return { keyword: q, color: null, features: [], source: 'LLM 不可用，降级关键词直查' };
    }
  }

  async search(userId: string, q: string, type: 'all' | 'item' | 'space') {
    await this.prisma.ensureUser(userId);
    // 全量空间只查一次，物品分支与空间分支共用（避免 type=all 时重复查询）
    const allSpaces = await this.prisma.space.findMany({ where: { userId } });
    const resp: Record<string, unknown> = {};

    if (type === 'item' || type === 'all') {
      const parsed = await this.parseForSearch(q);
      const keywords = parsed.keyword.split(/[|、,，\s]+/).filter(Boolean);
      if (!keywords.length) keywords.push(q);
      const contains = (k: string) => ({ contains: k, mode: 'insensitive' as const });
      const and: Prisma.ItemWhereInput[] = [
        {
          OR: keywords.flatMap((k) => [
            { name: contains(k) },
            { brand: contains(k) },
            { model: contains(k) },
            { category: contains(k) },
            { description: contains(k) },
          ]),
        },
      ];
      if (parsed.color) and.push({ color: { contains: parsed.color } });

      const rows = await this.prisma.item.findMany({
        where: { userId, deletedAt: null, AND: and },
        include: { space: true, tags: { include: { tag: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      const spaces = allSpaces;
      resp.parsed = parsed;
      resp.results = rows.map((r) => ({
        id: r.id,
        name: r.name,
        brand: r.brand,
        model: r.model,
        category: r.category,
        color: r.color,
        tags: r.tags.map((t) => t.tag.name),
        path: pathOf(spaces, r.spaceId),
        imageUrl: r.imageUrl,
        updatedAt: r.updatedAt,
      }));
    }

    if (type === 'space' || type === 'all') {
      // allSpaces 已在函数顶部加载一次（契约 3.1 要求 path 含祖先："我的家 → 书房"）
      const lower = q.toLowerCase();
      resp.spaces = allSpaces
        .filter((s) => s.name.toLowerCase().includes(lower))
        .map((s) => ({
          id: s.id,
          name: s.name,
          path: pathOf(allSpaces, s.id),
        }));
    }

    return resp;
  }

  /** 「你可能还想找」：本地聚合标签+分类高频词，最多 10，不调 LLM（契约 3.1） */
  async suggestions(userId: string) {
    const items = await this.prisma.item.findMany({
      where: { userId, deletedAt: null },
      include: { tags: { include: { tag: true } } },
    });
    const freq = new Map<string, number>();
    const bump = (w: string) => {
      w = (w || '').trim();
      if (w) freq.set(w, (freq.get(w) || 0) + 1);
    };
    for (const it of items) {
      bump(it.category || '');
      it.tags.forEach((t) => bump(t.tag.name));
    }
    const suggestions = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((e) => e[0]);
    return { suggestions };
  }
}
