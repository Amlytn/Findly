/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

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

  /** Vision 识图 → 结构化物品信息（usage 仅供落库统计，不返回给前端） */
  async recognize(imageDataUrl: string) {
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
    return {
      result: {
        ...json,
        confidence: typeof json.confidence === 'number' ? json.confidence : 0.5,
      },
      usage,
    };
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
        color: json.color || null,
        features: Array.isArray(json.features) ? json.features : [],
      },
      usage,
    };
  }
}
