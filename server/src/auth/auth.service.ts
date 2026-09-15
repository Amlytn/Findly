/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  /** 微信 code → openid → upsert 用户 → 签发 JWT（7 天） */
  async login(code: string) {
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_APPSECRET;
    if (!appid || !secret) throw new BadRequestException('服务端未配置 WX_APPID/WX_APPSECRET');
    let openid: string;
    try {
      const res = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: { appid, secret, js_code: code, grant_type: 'authorization_code' },
        timeout: 10000,
      });
      if (res.data?.openid) {
        openid = res.data.openid;
      } else {
        throw new Error(res.data?.errmsg || 'code 无效');
      }
    } catch (e: any) {
      throw new BadRequestException('微信登录失败：' + (e?.message || 'code 无效'));
    }
    let user = await this.prisma.user.findUnique({ where: { openid } });
    if (!user) user = await this.prisma.user.create({ data: { openid } });
    const token = await this.jwt.signAsync({ sub: user.id });
    return { token, user: { id: user.id, nickname: user.nickname, avatar: user.avatar } };
  }

  /** 联调测试通道：签发任意 userId 的 token（AUTH_DEV_TOKEN=1 时可用，M5 移除） */
  devToken(userId: string) {
    return this.jwt.signAsync({ sub: userId });
  }
}
