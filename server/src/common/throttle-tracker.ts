/**
 * @author james-wu66
 * Findly 后端 · 2026-09-23（C19）
 *
 * 限流"按什么分桶"。@nestjs/throttler 默认用 req.ip，而线上必然经 nginx 反代：
 * 不设 trust proxy 时全站用户都会被记成代理自己的同一个 IP ⇒ 一个人刷满 120/分钟，
 * 其他人跟着被限（AI 入口 10/分钟 更是直接被一个用户耗尽）。
 *
 * 这里改成"调用方身份优先、匿名流量兜底按 IP"：
 *  - 带 Authorization 头 → 按该头的短摘要分桶。一个账号一个桶；
 *    想绕开得再注册一个账号（与按验签后 userId 分桶的抗绕过能力等价），
 *    却不必为此调整守卫顺序（Throttler 现在跑在 JwtAuthGuard 之前，此时还没有可信身份可用）。
 *  - 不带 Authorization → 回落 IP，保住对无凭证垃圾请求的兜底。
 * 存摘要而不是存原 token：限流表在内存里，没必要让明文凭证躺在里面。
 */
import { createHash } from 'crypto';

export function throttleTracker(req: any): string {
  const auth = req?.headers?.authorization;
  if (typeof auth === 'string' && auth.length > 0) {
    return 'tok:' + createHash('sha1').update(auth).digest('base64url').slice(0, 16);
  }
  return 'ip:' + String(req?.ip ?? 'unknown');
}
