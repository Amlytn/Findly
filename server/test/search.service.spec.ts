/**
 * @author james-wu66
 * SearchService 单元测试：解析双路 + 降级落库 + color 条件拼装
 * Prisma / AiService 全部 mock，不连数据库（CI 可直接跑）
 */
import { SearchService } from '../src/search/search.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: any;
  let ai: any;

  beforeEach(() => {
    prisma = {
      ensureUser: jest.fn().mockResolvedValue({}),
      space: { findMany: jest.fn().mockResolvedValue([]) },
      item: { findMany: jest.fn().mockResolvedValue([]) },
      aIResult: { create: jest.fn().mockResolvedValue({}) },
    };
    ai = { parseQuery: jest.fn() };
    service = new SearchService(prisma, ai);
  });

  // ① 短词直查
  describe('① 短搜索词走关键词直查', () => {
    it('「鼠标」命中直查分支：source 标注为关键词直查，且不调用 AI、不落库', async () => {
      const res: any = await service.search('u1', '鼠标', 'item');
      expect(res.parsed.source).toBe('关键词直查数据库');
      expect(res.parsed.keyword).toBe('鼠标');
      expect(ai.parseQuery).not.toHaveBeenCalled();
      expect(prisma.aIResult.create).not.toHaveBeenCalled();
    });
  });

  // ② 长句走 LLM；失败必须降级且降级结果也要落库（否则降级率统计不出来）
  describe('② 长句走 LLM，不可用时降级', () => {
    it('解析成功：source=LLM Query Parser，并落库 1 条 AIResult', async () => {
      ai.parseQuery.mockResolvedValue({
        parsed: { keyword: '鼠标|滑鼠', color: null, features: ['无线'] },
        usage: { total_tokens: 87 },
      });
      const res: any = await service.search('u1', '帮我找一下那个无线的鼠标', 'item');
      expect(res.parsed.source).toBe('LLM Query Parser');
      expect(prisma.aIResult.create).toHaveBeenCalledTimes(1);
      const arg = prisma.aIResult.create.mock.calls[0][0];
      expect(arg.data.taskType).toBe('parse-query');
      expect(arg.data.userId).toBe('u1'); // C09：解析调用也要记归属
      expect(arg.data.resultJson).toContain('LLM Query Parser');
    });

    it('解析失败：降级为关键词直查，且降级路径同样落库（含根因 reason）', async () => {
      ai.parseQuery.mockRejectedValue(new Error('AI 服务暂时不可用（HTTP 401）'));
      const res: any = await service.search('u1', '帮我找一下那个无线的鼠标', 'item');
      expect(res.parsed.source).toBe('LLM 不可用，降级关键词直查');
      expect(res.parsed.keyword).toBe('帮我找一下那个无线的鼠标');
      expect(prisma.aIResult.create).toHaveBeenCalledTimes(1);
      const arg = prisma.aIResult.create.mock.calls[0][0];
      expect(arg.data.resultJson).toContain('降级');
      expect(arg.data.resultJson).toContain('HTTP 401');
      expect(arg.data.userId).toBe('u1'); // C09：降级落库同样要带归属，否则统计漏这一块
    });

    it('降级时落库本身失败，也不影响把降级结果返回给用户', async () => {
      ai.parseQuery.mockRejectedValue(new Error('boom'));
      prisma.aIResult.create.mockRejectedValue(new Error('db down'));
      const res: any = await service.search('u1', '帮我找一下那个无线的鼠标', 'item');
      expect(res.parsed.source).toBe('LLM 不可用，降级关键词直查');
    });
  });

  // ③ color 过滤条件拼装
  describe('③ color 过滤条件', () => {
    it('解析出颜色时，查询条件里带上 color contains', async () => {
      ai.parseQuery.mockResolvedValue({
        parsed: { keyword: '充电器', color: '白色', features: [] },
        usage: null,
      });
      await service.search('u1', '帮我找白色的那个充电器', 'item');
      const where = prisma.item.findMany.mock.calls[0][0].where;
      expect(JSON.stringify(where)).toContain('"color"');
      expect(JSON.stringify(where)).toContain('白色');
    });

    // C23：keyword 那五个字段都带了 mode:insensitive，color 分支原来漏了
    //（实测：库里存 "Black"，用 contains:"black" 命中 0 条；加 insensitive 命中 1 条）
    it('color 条件必须与关键词同口径：带 mode:insensitive', async () => {
      ai.parseQuery.mockResolvedValue({
        parsed: { keyword: 'charger', color: 'black', features: [] },
        usage: null,
      });
      await service.search('u1', '帮我找黑色的那个charger', 'item');
      const and = prisma.item.findMany.mock.calls[0][0].where.AND as any[];
      const colorCond = and.find((c) => Object.prototype.hasOwnProperty.call(c, 'color'));
      expect(colorCond.color).toEqual({ contains: 'black', mode: 'insensitive' });
    });

    it('没有颜色时不追加 color 条件', async () => {
      await service.search('u1', '鼠标', 'item');
      const where = prisma.item.findMany.mock.calls[0][0].where;
      const and = where.AND as any[];
      expect(and.some((c) => Object.prototype.hasOwnProperty.call(c, 'color'))).toBe(false);
    });
  });

  // 顺带覆盖：关键词按分隔符拆成同义词数组
  describe('关键词拆分为同义词', () => {
    it('「鼠标|滑鼠」会拆成两个关键词分别参与 OR 匹配', async () => {
      ai.parseQuery.mockResolvedValue({
        parsed: { keyword: '鼠标|滑鼠', color: null, features: [] },
        usage: null,
      });
      await service.search('u1', '帮我找一下那个无线的鼠标', 'item');
      const where = prisma.item.findMany.mock.calls[0][0].where;
      const or = (where.AND as any[])[0].OR as any[];
      const flat = JSON.stringify(or);
      expect(flat).toContain('鼠标');
      expect(flat).toContain('滑鼠');
    });
  });
});
