import {
  BadRequestException, PayloadTooLargeException, Body, Controller, Post, Req,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { userIdFrom } from '../common/user.util';
import { RecognizeDto } from './dto';

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

    const result = await this.ai.recognize(dto.imageBase64);

    // 记录每次 AI 调用（方案文档 AIResult 表；同时是面试量化点的数据来源）
    await this.prisma.aIResult.create({
      data: {
        taskType: 'recognize',
        model: process.env.QWEN_VL_MODEL || 'qwen-vl-plus',
        resultJson: JSON.stringify(result),
      },
    });
    return result;
  }
}
