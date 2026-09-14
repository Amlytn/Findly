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

  /** 本阶段用演示用户（请求头 x-user-id，缺省 dev）；微信登录在 M4 接入后替换 */
  async ensureUser(id: string) {
    const exists = await this.user.findUnique({ where: { id } });
    if (!exists) await this.user.create({ data: { id, openid: `dev-${id}` } });
  }
}
