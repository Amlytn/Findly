/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { SearchModule } from './search/search.module';
// @Amlytn TODO: items/spaces 模块待实现后在此追加 import。
@Module({
  imports: [PrismaModule, AiModule, SearchModule],
})
export class AppModule {}
