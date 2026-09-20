/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16（PATCH /me 契约 v1.4 2026-09-19）
 */
import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { userIdFrom } from '../common/user.util';

class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(30) nickname?: string;
  @IsOptional() @IsString() @MaxLength(500) avatar?: string;
}

@ApiTags('用户 Users')
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

  /** 更新当前用户资料（昵称/头像）；字段缺省不更新，null 显式置空 */
  @Patch('me')
  async updateMe(@Req() req, @Body() dto: UpdateMeDto) {
    const userId = userIdFrom(req);
    await this.prisma.ensureUser(userId);
    const data: { nickname?: string | null; avatar?: string | null } = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (Object.keys(data).length) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return { id: userId, nickname: user?.nickname ?? null, avatar: user?.avatar ?? null };
  }
}
