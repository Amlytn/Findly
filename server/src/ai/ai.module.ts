/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService], // search 模块复用 parseQuery
})
export class AiModule {}
