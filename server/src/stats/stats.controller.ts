/**
 * @author james-wu66
 * Findly 后端 · 2026-09-17（B02：用量统计）· 2026-09-22（C09：按调用者归属）
 *
 * 认证由全局 JwtAuthGuard 负责，与其他接口一致，此处不再单独处理。
 * C09 后统计口径是"当前登录用户自己的 AI 调用"，不再是全平台聚合。
 */
import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { userIdFrom } from '../common/user.util';

const MAX_RANGE_DAYS = 365;

@ApiTags('统计 Stats')
@Controller('api/v1/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @ApiOperation({
    summary: '当前用户的 AI 用量统计（调用数 / token / 估算成本 / 降级率 / 缓存命中率）',
  })
  overview(@Req() req, @Query('days') days?: string) {
    let range: number | undefined;
    if (days !== undefined && days !== '') {
      range = Number(days);
      if (!Number.isInteger(range) || range < 1 || range > MAX_RANGE_DAYS) {
        throw new BadRequestException(`days 必须是 1~${MAX_RANGE_DAYS} 之间的整数`);
      }
    }
    return this.stats.overview(userIdFrom(req), range);
  }
}
