/**
 * @author james-wu66
 * AiService 单元测试：JSON 提取容错 + 识别缓存
 * 模型调用（chat）被 spy 掉，不发真实网络请求
 */
import { BadRequestException } from '@nestjs/common';
import { AiService } from '../src/ai/ai.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    process.env.DASHSCOPE_API_KEY = 'test-key';
    service = new AiService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ⑧ extractJson：剥掉 markdown 围栏、截取 JSON
  describe('⑧ extractJson 容错提取', () => {
    it('剥掉 ```json 围栏后正常解析', () => {
      const out = (service as any).extractJson('```json\n{"name":"鼠标"}\n```');
      expect(out).toEqual({ name: '鼠标' });
    });

    it('剥掉无语言标记的 ``` 围栏', () => {
      const out = (service as any).extractJson('```\n{"name":"键盘"}\n```');
      expect(out).toEqual({ name: '键盘' });
    });

    it('模型在 JSON 前后夹带解释文字时，取第一个 { 到最后一个 }', () => {
      const out = (service as any).extractJson('好的，结果如下：{"name":"充电器","color":"白"} 以上。');
      expect(out).toEqual({ name: '充电器', color: '白' });
    });
  });

  // ⑨ 坏输出 → 友好文案的 BadRequestException（不是 500）
  describe('⑨ 无法解析时给友好文案', () => {
    it('完全没有花括号 → 抛 BadRequestException 且文案友好', () => {
      expect(() => (service as any).extractJson('我没看懂这张图')).toThrow(BadRequestException);
      expect(() => (service as any).extractJson('我没看懂这张图')).toThrow(
        '暂时无法准确识别这个物品，你可以手动填写名称。',
      );
    });

    it('有花括号但内容不是合法 JSON → 同样抛友好文案', () => {
      expect(() => (service as any).extractJson('{name: 鼠标,}')).toThrow(BadRequestException);
    });

    it('可以自定义友好文案（parse-query 场景）', () => {
      expect(() =>
        (service as any).extractJson('无内容', '搜索词解析失败，已降级关键词直查。'),
      ).toThrow('搜索词解析失败，已降级关键词直查。');
    });
  });

  // ⑩ 识别缓存：同图重复识别不重复调模型（成本防线）
  describe('⑩ 识别结果缓存', () => {
    const modelOutput =
      '{"name":"鼠标","category":"外设","brand":"罗技","model":null,"color":"黑色","description":"无线鼠标","tags":["无线"],"confidence":0.92}';

    it('同一张图识别两次，模型只被调用 1 次，第二次带 cached 标记', async () => {
      const chatSpy = jest
        .spyOn(service as any, 'chat')
        .mockResolvedValue({ content: modelOutput, usage: { total_tokens: 120 } });

      const first: any = await service.recognize('dev', 'data:image/jpeg;base64,AAAA');
      const second: any = await service.recognize('dev', 'data:image/jpeg;base64,AAAA');

      expect(chatSpy).toHaveBeenCalledTimes(1);
      expect(first.result.cached).toBeUndefined();
      expect(second.result.cached).toBe(true);
      expect(second.result.name).toBe('鼠标');
      // C03：命中缓存 = 本次零 token，不得回传首次的 usage，
      // 否则控制器无条件落库会把同一笔用量重复计入，成本统计虚高
      expect(second.usage).toBeNull();
    });

    it('不同图片不会命中同一缓存', async () => {
      const chatSpy = jest
        .spyOn(service as any, 'chat')
        .mockResolvedValue({ content: modelOutput, usage: null });

      await service.recognize('dev', 'data:image/jpeg;base64,AAAA');
      await service.recognize('dev', 'data:image/jpeg;base64,BBBB');

      expect(chatSpy).toHaveBeenCalledTimes(2);
    });

    it('模型没给 confidence 时兜底为 0.5', async () => {
      jest
        .spyOn(service as any, 'chat')
        .mockResolvedValue({ content: '{"name":"U盘"}', usage: null });
      const res: any = await service.recognize('dev', 'data:image/jpeg;base64,CCCC');
      expect(res.result.confidence).toBe(0.5);
    });
  });

  // 顺带覆盖：未配置 key 时的行为
  describe('未配置 API Key', () => {
    it('没有 key 时 chat 抛 503（ServiceUnavailable），不会发出网络请求', async () => {
      delete process.env.DASHSCOPE_API_KEY;
      await expect(service.parseQuery('测试')).rejects.toThrow('未配置 DASHSCOPE_API_KEY');
    });
  });
});
