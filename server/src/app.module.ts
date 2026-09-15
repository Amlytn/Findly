/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { SearchModule } from './search/search.module';
import { ItemsModule } from './items/items.module';
import { SpacesModule } from './spaces/spaces.module';
// @Amlytn TODO: auth/users/upload 模块待实现后在此追加 import（M4）。
@Module({
  imports: [PrismaModule, AiModule, SearchModule, ItemsModule, SpacesModule],
})
export class AppModule {}
