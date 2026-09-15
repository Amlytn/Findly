/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16
 */
import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const ALLOW = ['.png', '.jpg', '.jpeg', '.webp'];

@Controller('api/v1/upload')
export class UploadController {
  /** multipart 字段名 file；png/jpeg/webp；≤4MB；随机文件名防覆盖/路径攻击 */
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
      },
      filename: (_req, file, cb) => {
        cb(null, Date.now() + '-' + randomBytes(8).toString('hex')
          + extname(file.originalname).toLowerCase());
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!ALLOW.includes(extname(file.originalname).toLowerCase())) {
        cb(new BadRequestException('仅支持 png/jpeg/webp 图片'), false);
        return;
      }
      cb(null, true);
    },
    limits: { fileSize: 4 * 1024 * 1024 },
  }))
  upload(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('请用 multipart/form-data 上传，字段名 file');
    return { imageUrl: '/uploads/' + file.filename };
  }
}
