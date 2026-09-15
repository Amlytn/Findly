/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14（M4 增加上传静态目录 2026-09-16）
 */
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors(); // 允许联调跨域；上线前收紧到小程序域名
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // 本地上传目录静态服务（M4；迁移对象存储后移除）
  const uploadDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`Findly server running at http://localhost:${port}`);
}
bootstrap();
