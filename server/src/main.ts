/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14（M4 增加上传静态目录 2026-09-16）
 */
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { LoggingInterceptor } from './common/logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors(); // 允许联调跨域；上线前收紧到小程序域名
  // 识图 base64 走 JSON body，express 默认 100KB 会把大图请求拒成不可诊断的 500；
  // 上限 6MB：与 /ai/recognize 的 4MB base64 检查之间留出 JSON 包装与多字段余量
  app.use(json({ limit: '6mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // B04：统一异常响应格式 + 每请求一行日志（与上面的 Pipes 同为全局注册）
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  // B05：Swagger 接口文档（浏览器打开 http://localhost:3000/api/docs）
  const config = new DocumentBuilder()
    .setTitle('Findly API')
    .setDescription('个人物品管理 + AI 搜索 后端接口文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  // 本地上传目录静态服务（M4；迁移对象存储后移除）
  const uploadDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`Findly server running at http://localhost:${port}`);
}
bootstrap();
