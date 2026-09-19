/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  /** 幂等建户（upsert 防并发首请求触发唯一约束冲突） */
  async ensureUser(id: string) {
    await this.user.upsert({
      where: { id },
      update: {},
      create: { id, openid: `dev-${id}` },
    });
  }
}
