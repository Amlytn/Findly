/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * 全局守卫（过渡方案，M5 收紧）：
 * - 带 Authorization: Bearer <token> → 校验 JWT，把验证出的身份覆写进 x-user-id 头，
 *   items/spaces/search/ai 等控制器零改动即获得真实身份；
 * - 不带 token → 保持 x-user-id 原样（演示期兼容；M5 移除兜底并改为 401）；
 * - token 无效 → 当前不拦截（同上过渡行为）。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.['authorization'] as string | undefined;
    if (!auth || !auth.startsWith('Bearer ')) return true;
    try {
      const payload = await this.jwt.verifyAsync(auth.slice(7));
      if (payload?.sub) req.headers['x-user-id'] = payload.sub;
    } catch {
      /* 无效 token：过渡期不拦截 */
    }
    return true;
  }
}
