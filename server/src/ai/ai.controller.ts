/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import {
  BadRequestException, PayloadTooLargeException, Body, Controller, Post, Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { userIdFrom } from '../common/user.util';
import { RecognizeDto } from './dto';

// AI 是计费入口，限流最严：每用户/IP 10 次/分钟（全局 120 次由 ThrottlerModule 兜底）
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('api/v1/ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('recognize')
  async recognize(@Req() req, @Body() dto: RecognizeDto) {
    const userId = userIdFrom(req);
    await this.prisma.ensureUser(userId);

    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(dto.imageBase64)) {
      throw new BadRequestException('imageBase64 必须是 data:image/png|jpeg|webp;base64, 开头的字符串');
    }
    if (dto.imageBase64.length * 0.75 > 4 * 1024 * 1024) {
      throw new PayloadTooLargeException('图片超过 4MB，请先压缩再上传');
    }

    const { result, usage } = await this.ai.recognize(userId, dto.imageBase64);

    // 记录每次 AI 调用（方案文档 AIResult 表；同时是面试量化点的数据来源）
    // 仅存关键字段控制体积：description/tags 体积大且对成本/准确率量化价值低
    // usage（prompt/completion/total tokens）随记录落库，单次成本可直接从本表计算
    const { description, tags, ...trimmed } = result;
    const record = await this.prisma.aIResult.create({
      data: {
        taskType: 'recognize',
        model: process.env.QWEN_VL_MODEL || 'qwen-vl-plus',
        resultJson: JSON.stringify({ ...trimmed, usage }),
      },
    });
    // 契约 v1.2：返回 aiResultId，前端保存物品时经 POST /items 带回回填 AIResult.itemId
    return { ...result, aiResultId: record.id };
  }
}
