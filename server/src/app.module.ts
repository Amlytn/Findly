/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14（M4：注册 upload/auth/users + 全局限流/身份守卫 2026-09-16）
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { SearchModule } from './search/search.module';
import { ItemsModule } from './items/items.module';
import { SpacesModule } from './spaces/spaces.module';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StatsModule } from './stats/stats.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
// @Amlytn TODO: settings 等模块待实现后在此追加 import。
@Module({
  imports: [
    ConfigModule.forRoot(),
    // 全局限流：120 次/分钟；/ai/* 在其控制器上单独加严到 10 次/分钟
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AiModule,
    SearchModule,
    ItemsModule,
    SpacesModule,
    UploadModule,
    AuthModule,
    UsersModule,
    StatsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
