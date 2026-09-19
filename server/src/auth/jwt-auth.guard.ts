/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16（M5 收紧 2026-09-19）
 *
 * 全局守卫：
 * - @Public() 标记的路由（auth/login、auth/dev-token）不要求凭证；
 * - 其余路由必须携带有效 Bearer token，验签通过后把身份（payload.sub）
 *   覆写进 x-user-id 头——控制器仍从该头取值，但值已不可伪造；
 * - 无 token / token 无效 → 401，前端 request 层据此自动重登并重放原请求。
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.['authorization'] as string | undefined;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少登录凭证');
    }
    try {
      const payload = await this.jwt.verifyAsync(auth.slice(7));
      if (!payload?.sub) throw new Error('token 缺少身份');
      req.headers['x-user-id'] = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}
