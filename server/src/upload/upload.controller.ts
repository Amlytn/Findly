/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16（magic bytes 校验 2026-09-19）
 *
 * POST /api/v1/upload：multipart 字段名 file，png/jpeg/webp，≤4MB（413）。
 * memoryStorage：先在内存中做文件头校验，通过后才落盘——扩展名可伪装，
 * 仅查 extname 挡不住把任意内容改名为 .png 的上传。
 */
import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const ALLOW = ['.png', '.jpg', '.jpeg', '.webp'];

/** 文件头白名单：PNG(\x89PNG) / JPEG(\xFF\xD8\xFF) / WEBP(RIFF....WEBP) */
function isAllowedImageBytes(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return true;
  return false;
}

@Controller('api/v1/upload')
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOW.includes(extname(file.originalname).toLowerCase())) {
        cb(new BadRequestException('仅支持 png/jpeg/webp 图片'), false);
        return;
      }
      cb(null, true);
    },
  }))
  async upload(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('请用 multipart/form-data 上传，字段名 file');
    if (!isAllowedImageBytes(file.buffer)) {
      throw new BadRequestException('文件内容不是有效的图片，请直接上传原始图片文件');
    }
    // 服务端生成随机文件名：防覆盖、防路径穿越；扩展名已过白名单
    const filename = Date.now() + '-' + randomBytes(8).toString('hex')
      + extname(file.originalname).toLowerCase();
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);
    return { imageUrl: '/uploads/' + filename };
  }
}
