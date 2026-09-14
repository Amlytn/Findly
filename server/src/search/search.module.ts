/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
