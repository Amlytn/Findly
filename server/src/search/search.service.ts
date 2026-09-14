/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

/**
 * 搜索策略（方案文档第九/十节）：
 * 简单词 → 直接查数据库；复杂自然语言 → LLM 解析为结构化条件再查；
 * LLM 不可用 → 自动降级为关键词直查，source 字段如实标注。
 */
@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  async search(userId: string, q: string) {
    await this.prisma.ensureUser(userId);

    const isSimple = q.length <= 6 && !/在哪|哪里|什么颜色|帮我找|怎么找/.test(q);
    let parsed: { keyword: string; color: string | null; features: string[]; source: string };
    if (isSimple) {
      parsed = { keyword: q, color: null, features: [], source: '关键词直查数据库' };
    } else {
      try {
        parsed = { ...(await this.ai.parseQuery(q)), source: 'LLM Query Parser' };
      } catch {
        parsed = { keyword: q, color: null, features: [], source: 'LLM 不可用，降级关键词直查' };
      }
    }

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

    // 组装位置路径："我的家 → 书房 → 书桌 → 右侧抽屉"
    const spaces = await this.prisma.space.findMany({ where: { userId } });
    const byId = new Map(spaces.map((s) => [s.id, s]));
    const pathOf = (id: string | null): string => {
      if (!id) return '未归位';
      const chain: string[] = [];
      let cur = byId.get(id);
      let guard = 0;
      while (cur && guard++ < 20) {
        chain.unshift(cur.name);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      return chain.join(' → ');
    };

    return {
      parsed,
      results: rows.map((r) => ({
        id: r.id,
        name: r.name,
        brand: r.brand,
        model: r.model,
        category: r.category,
        color: r.color,
        tags: r.tags.map((t) => t.tag.name),
        path: pathOf(r.spaceId),
        imageUrl: r.imageUrl,
        updatedAt: r.updatedAt,
      })),
    };
  }
}
