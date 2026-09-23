/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';

// 阿里云百炼 DashScope 的 OpenAI 兼容模式（换模型只改 .env，不动代码）
const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

const RECOGNIZE_PROMPT =
  '识别图片中的物品，只输出一个 JSON 对象，不要输出任何其他文字或代码块标记。' +
  '字段：name(物品名称), category(分类), brand(品牌,未知则null), model(型号,未知则null), ' +
  'color(颜色,中文), description(一句话描述), tags(3-5个标签数组), confidence(0到1的小数)。';

const PARSE_PROMPT =
  '你是物品搜索查询解析器。把用户的搜索句解析为 JSON，只输出 JSON：' +
  '{"keyword":"最核心的物品词，可用|分隔同义词","color":"颜色词，没有则null","features":["其他特征词"]}';

@Injectable()
export class AiService {
  /** 识别结果缓存：key=sha256(完整 base64)，TTL 24h；同图重复识别零模型调用（成本防线） */
  private cache = new Map<string, { result: any; usage: any; expires: number }>();
  private static CACHE_TTL = 24 * 60 * 60 * 1000;

  private get apiKey() {
    return process.env.DASHSCOPE_API_KEY || '';
  }

  /** 返回模型输出与 DashScope 的 token 用量（usage 存入 AIResult，作为单次成本量化数据源） */
  private async chat(model: string, messages: any[], maxTokens = 500): Promise<{ content: string; usage: any }> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('未配置 DASHSCOPE_API_KEY，AI 功能不可用');
    }
    try {
      const res = await axios.post(
        `${DASHSCOPE_BASE}/chat/completions`,
        { model, messages, max_tokens: maxTokens },
        { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 30000 },
      );
      return {
        content: res.data?.choices?.[0]?.message?.content ?? '',
        usage: res.data?.usage || null,
      };
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      // 根因随 503 暴露（HTTP 状态码/网络错误码），供降级路径写入 AIResult 排障；不泄露 key
      const detail = e?.response?.status
        ? `HTTP ${e.response.status}`
        : (e?.code || e?.message || '未知错误');
      throw new ServiceUnavailableException(`AI 服务暂时不可用（${detail}）`);
    }
  }

  /** 剥掉可能的 markdown 代码块并截取 JSON，解析失败给友好文案（方案文档第二十一节） */
  private extractJson(text: string, friendlyMessage = '暂时无法准确识别这个物品，你可以手动填写名称。'): any {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new BadRequestException(friendlyMessage);
    }
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new BadRequestException(friendlyMessage);
    }
  }

  /** Vision 识图 → 结构化物品信息（usage 仅供落库统计，不返回给前端）。
   * 缓存 key 掺入 userId：识图结果虽然只由图片内容决定，但按用户隔离
   * 避免跨用户命中（隐私最小化，成本防线不受影响——同用户同图仍零调用） */
  async recognize(userId: string, imageDataUrl: string) {
    const key = createHash('sha256').update(userId + '|' + imageDataUrl).digest('hex');
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) {
      // C03：命中缓存 = 本次零模型调用、零 token，usage 必须是 null。
      // 此前原样回传首次调用的 usage，而控制器又无条件把每次识别落库，
      // 导致同一张图重复保存会重复计 token/成本 —— 用量统计与 usage.cjs 全线虚高。
      // 首次那笔用量已记在它自己的 AIResult 行上，不需要也不应该再记一遍。
      return { result: { ...hit.result, cached: true }, usage: null };
    }
    const { content, usage } = await this.chat(process.env.QWEN_VL_MODEL || 'qwen-vl-plus', [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageDataUrl } },
          { type: 'text', text: RECOGNIZE_PROMPT },
        ],
      },
    ]);
    const json = this.extractJson(content);
    const result = {
      ...json,
      confidence: typeof json.confidence === 'number' ? json.confidence : 0.5,
    };
    this.cache.set(key, { result, usage, expires: Date.now() + AiService.CACHE_TTL });
    if (this.cache.size > 200) {
      for (const [k, v] of this.cache) if (v.expires <= Date.now()) this.cache.delete(k);
    }
    return { result, usage };
  }

  /** 自然语言搜索句 → 结构化查询条件（方案文档第九节 Query Parser） */
  async parseQuery(q: string) {
    const { content, usage } = await this.chat(process.env.QWEN_TEXT_MODEL || 'qwen-turbo', [
      { role: 'user', content: `${PARSE_PROMPT}\n用户搜索：${q}` },
    ], 200);
    const json = this.extractJson(content, '搜索词解析失败，已降级关键词直查。');
    return {
      parsed: {
        keyword: String(json.keyword || q),
        // C23：color 必须归一为字符串或 null。模型偶发把 color 返回成对象/数组
        //（如 {"color":{"主色":"黑"}}），原样透传到 Prisma 的 contains 会直接抛错 ⇒ 搜索接口 500。
        // keyword 早就有 String() 兜底，color 是漏的那个。空串/纯空白同样归 null（等于不过滤）。
        color: typeof json.color === 'string' && json.color.trim() ? json.color.trim() : null,
        features: Array.isArray(json.features) ? json.features : [],
      },
      usage,
    };
  }
}
