/**
 * @author james-wu66
 * Findly 后端 · 2026-09-17（B02：用量统计）
 *
 * PrismaModule 已声明为 @Global()，此处无需 import。
 */
import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
