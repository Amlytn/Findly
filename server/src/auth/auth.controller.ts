/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16（M5 收紧 2026-09-19）
 */
import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

class LoginDto {
  @IsString() @IsNotEmpty() code: string;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /** 登录本身不要求凭证 */
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.code);
  }

  /** 联调专用：签发测试 token。双重开关：NODE_ENV=development 且 AUTH_DEV_TOKEN=1；
   * 生产环境该通道直接 403，不再依赖人工记得移除（不入对外契约） */
  @Public()
  @Get('dev-token')
  async devToken(@Query('userId') userId: string) {
    if (process.env.NODE_ENV !== 'development' || process.env.AUTH_DEV_TOKEN !== '1') {
      throw new ForbiddenException('联调通道仅限开发环境（需 NODE_ENV=development 且 AUTH_DEV_TOKEN=1）');
    }
    if (!userId) throw new BadRequestException('缺少 userId');
    return { token: await this.auth.devToken(userId) };
  }
}
