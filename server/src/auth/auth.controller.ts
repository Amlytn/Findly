/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16
 */
import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString() @IsNotEmpty() code: string;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.code);
  }

  /** 联调专用：签发测试 token（AUTH_DEV_TOKEN=1 时可用，M5 移除；不入对外契约） */
  @Get('dev-token')
  async devToken(@Query('userId') userId: string) {
    if (process.env.AUTH_DEV_TOKEN !== '1') throw new ForbiddenException('未开启 AUTH_DEV_TOKEN');
    if (!userId) throw new BadRequestException('缺少 userId');
    return { token: await this.auth.devToken(userId) };
  }
}
