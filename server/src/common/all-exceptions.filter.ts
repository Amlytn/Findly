/**
 * @author james-wu66
 * Findly 后端 · 2026-09-17（B04：统一异常响应格式）
 *
 * 两条规则：
 *  1. HttpException 原样透传 —— 状态码与 message 一律不改（前端已依赖 400/404/429 的现有文案）；
 *  2. 未知异常统一转 500 友好文案，完整堆栈只写服务端日志，绝不外泄给客户端。
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { STATUS_CODES } from 'http';

const FRIENDLY_500 = '服务器内部错误，请稍后重试';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = FRIENDLY_500;

    if (exception instanceof HttpException) {
      // 业务异常：状态码与文案原样透传（校验失败、404、限流 429 都走这里）
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const m = (body as { message?: string | string[] }).message;
        message = m !== undefined ? m : exception.message;
      }
    } else if ((exception as { type?: string })?.type === 'entity.too.large') {
      // body-parser 体积超限（express json）：此前落进未知异常被报成 500，前端无法诊断
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = '请求体超过大小限制，请压缩后再试';
      this.logger.warn(`${req.method} ${req.originalUrl} 请求体超限（413）`);
    } else if ((exception as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
      // multer 体积超限（/upload 的 4MB 上限）
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = '图片超过 4MB，请先压缩再上传';
      this.logger.warn(`${req.method} ${req.originalUrl} 上传超限（413）`);
    } else {
      // 未知异常：详情只进服务端日志，客户端拿到统一文案
      const detail =
        exception instanceof Error ? exception.stack || exception.message : String(exception);
      this.logger.error(`${req.method} ${req.originalUrl} 未捕获异常：${detail}`);
    }

    res.status(status).json({
      statusCode: status,
      message,
      error: STATUS_CODES[status] || 'Error',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
