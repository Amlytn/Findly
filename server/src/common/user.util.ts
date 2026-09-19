/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14（M5 收紧 2026-09-19）
 *
 * 从请求头取用户 id：JwtAuthGuard 验签通过后会把 payload.sub 覆写进
 * x-user-id 头——此处取到的值已不可伪造（无 token 的请求在守卫层就 401 了）。
 */
export function userIdFrom(req: any): string {
  return req.headers?.['x-user-id'] as string;
}
