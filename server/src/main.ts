/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14（M4 增加上传静态目录 2026-09-16）
 */
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { LoggingInterceptor } from './common/logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors(); // 允许联调跨域；上线前收紧到小程序域名
  // C19：经 nginx 反代后 req.ip 恒为代理地址（限流兜底桶与日志里的 IP 全失真）。
  // 跳数由环境显式给出、默认不信任任何跳：X-Forwarded-For 是客户端可伪造的头，
  // 本地直连时开着反而等于给"随手改个头就绕开 IP 兜底"留口子。部署清单里写 TRUST_PROXY_HOPS=1。
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS);
  if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }
  // 识图 base64 走 JSON body，express 默认 100KB 会把大图请求拒成不可诊断的 500；
  // 上限 6MB：与 /ai/recognize 的 4MB base64 检查之间留出 JSON 包装与多字段余量
  app.use(json({ limit: '6mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // B04：统一异常响应格式 + 每请求一行日志（与上面的 Pipes 同为全局注册）
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  // B05：Swagger 接口文档（浏览器打开 http://localhost:3000/api/docs）
  // C01：生产环境不挂载 —— 实测原实现不带 token 也返回 200，等于向任何人公开全部接口结构。
  // 需要在线上临时开启时，显式设 SWAGGER=1（并自行加反代/basic auth 保护）。
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER === '1') {
    const config = new DocumentBuilder()
      .setTitle('Findly API')
      .setDescription('个人物品管理 + AI 搜索 后端接口文档')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }
  // 本地上传目录静态服务（M4；迁移对象存储后移除）
  // C02：uploads/ 存的是用户拍的物品照片，此前挂在 Nest 全局守卫链之外——实测不带 token
  // 访问返回 404 而非 401，即请求根本没进守卫，文件存在就被直接吐出。这里在静态中间件
  // 之前补一道 JWT 校验。小程序 <image src> 发不出 Authorization 头，故同时接受 ?token=
  //（前端 services/config.ts 的 fullUrl() 是唯一收口，加一处即全覆盖）。
  const jwtService = app.get(JwtService);
  app.use('/uploads/', async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    const qtok = req.query?.token;
    const raw =
      typeof auth === 'string' && auth.startsWith('Bearer ')
        ? auth.slice(7)
        : typeof qtok === 'string'
          ? qtok
          : '';
    try {
      const payload = raw ? await jwtService.verifyAsync(raw) : null;
      if (!payload?.sub) throw new Error('缺少或无效凭证');
      next();
    } catch {
      res.status(401).json({
        statusCode: 401,
        message: '图片访问需登录凭证',
        error: 'Unauthorized',
        path: req.originalUrl,
      });
    }
  });
  const uploadDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`Findly server running at http://localhost:${port}`);
}
bootstrap();
