/**
 * @author james-wu66
 * Findly 后端 · 2026-09-23
 *
 * /uploads/ 静态资源的访问守卫（C02 建，C22/C18 本轮补）。
 * 单独抽成模块的原因：这段逻辑挂在 Nest 生命周期之外的 express 中间件层，
 * 留在 main.ts 里就没法做单测——而 C22 恰恰是一个"看起来能跑、错误信息却会骗人"的坑。
 *
 * 三件事：
 *  1. 鉴权：小程序 <image src> 发不出 Authorization 头，故 Bearer 与 ?token= 两条路都收；
 *  2. C22：凭证校验的 try 与 next() 分开。原实现把 next() 写在同一个 try 里，
 *     下游静态服务抛的任何错都会被 catch 成 401「图片访问需登录凭证」——
 *     而本中间件是 async，若只是把 next() 挪出去不做处理，抛错会变成 unhandled rejection 把进程打挂，
 *     所以正确写法是单独 try 并 next(err) 交给 Express 错误链（真实原因保留，状态码也不再骗人）；
 *  3. C18：图片访问此前一条日志都没有（静态中间件在 Nest 拦截器之外）。这里补一行，
 *     且只记 req.path —— originalUrl 带着 ?token=，绝不能进日志。
 */
import { Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';

/** 从 Bearer 头或 ?token= 取出原始 token 字符串；两者都没有时返回空串 */
function rawToken(req: Request): string {
  const auth = req.headers?.authorization;
  const qtok = (req.query as Record<string, unknown> | undefined)?.token;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return typeof qtok === 'string' ? qtok : '';
}

/** 只声明用到的两个方法：Nest 的 Logger 结构上满足它，单测传个假对象即可，不必 as any */
export interface UploadsAccessLogger {
  log(message: string): void;
  warn(message: string): void;
}

/** 日志用的路径：originalUrl 去掉 query。
 *  不用 req.path —— 挂载式中间件里 express 会把 '/uploads/' 前缀剥掉，日志就成了裸文件名，不好 grep。
 *  也不能用 originalUrl 原值 —— 那上面带着 ?token=。 */
function logPath(req: Request): string {
  return String(req.originalUrl ?? req.path ?? '').split('?')[0];
}

export function uploadsAuthGuard(
  jwtService: JwtService,
  logger: UploadsAccessLogger = new Logger('UploadsAuth'),
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const raw = rawToken(req);
    let sub: string | undefined;
    try {
      const payload = raw ? await jwtService.verifyAsync(raw) : null;
      sub = payload?.sub;
    } catch {
      sub = undefined; // 无效/过期凭证按未登录处理，统一走下面的 401
    }

    if (!sub) {
      // 拒绝也要留痕，否则被扫接口时事后无从查证
      logger.warn(`401 ${req.method} ${logPath(req)}`);
      res.status(401).json({
        statusCode: 401,
        message: '图片访问需登录凭证',
        error: 'Unauthorized',
        path: req.originalUrl,
      });
      return;
    }

    // C18：只记去掉了 query 的路径，token 不落日志；res 'finish' 时状态码才是最终值
    const path = logPath(req);
    res.on('finish', () => logger.log(`${sub} ${req.method} ${path} → ${res.statusCode}`));

    try {
      next();
    } catch (err) {
      // C22：下游静态服务的异常交给 Express 错误链，不再被伪装成 401
      next(err as Error);
    }
  };
}
