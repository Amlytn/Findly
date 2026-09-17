/**
 * @author james-wu66
 * Findly 后端 · 2026-09-17（B02：用量统计）
 *
 * 认证由全局 JwtAuthGuard 负责，与其他接口一致，此处不再单独处理。
 */
import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('api/v1/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  overview() {
    return this.stats.overview();
  }
}
