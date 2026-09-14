import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { SearchModule } from './search/search.module';
// items/spaces（同学负责）成型后在此追加 import。
@Module({
  imports: [PrismaModule, AiModule, SearchModule],
})
export class AppModule {}
