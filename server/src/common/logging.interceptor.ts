/**
 * @author james-wu66
 * Findly 后端 · 2026-09-17（B04：请求日志）
 *
 * 每个请求输出一行：[HTTP] 方法 完整路径 状态码 耗时ms
 *
 * 实现说明（踩过的坑）：不能用 rxjs 的 finalize/tap 读 res.statusCode ——
 * Nest 的执行顺序是「拦截器 → 异常过滤器」，finalize 触发时异常过滤器尚未设置状态码，
 * 读到的仍是默认 200，会把 400/404 记成 200。改用响应的 'finish' 事件，
 * 此时响应已真正发出，状态码必然准确。
 * 局限：连接被客户端提前掐断导致响应未发出时，不会触发 finish，该请求不产生日志。
 */
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    res.on('finish', () => {
      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`,
      );
    });

    return next.handle();
  }
}
