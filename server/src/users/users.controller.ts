/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16
 */
import { Controller, Get, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { userIdFrom } from '../common/user.util';

@Controller('api/v1/users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  async me(@Req() req) {
    const userId = userIdFrom(req);
    await this.prisma.ensureUser(userId);
    const [user, itemCount, spaceCount] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.item.count({ where: { userId, deletedAt: null } }),
      this.prisma.space.count({ where: { userId } }),
    ]);
    return {
      id: userId,
      nickname: user?.nickname ?? null,
      avatar: user?.avatar ?? null,
      itemCount,
      spaceCount,
    };
  }
}
