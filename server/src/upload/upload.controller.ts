/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16（magic bytes 校验 2026-09-19；B03 孤儿图片清理 2026-09-20）
 *
 * POST /api/v1/upload：multipart 字段名 file，png/jpeg/webp，≤4MB（413）。
 * memoryStorage：先在内存中做文件头校验，通过后才落盘——扩展名可伪装，
 * 仅查 extname 挡不住把任意内容改名为 .png 的上传。
 */
import { BadRequestException, Body, Controller, ForbiddenException, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { UploadService } from './upload.service';
import { userIdFrom } from '../common/user.util';

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

/** C17 权限门：破坏性运维接口默认关闭，且开启后仍要在名单里。
 *  动因：孤儿图片的"是否被引用"是跨用户全表判断的，任何登录用户调 dryRun:false
 *  都能删掉全站 24h 未引用的图片；大量调用还能靠全表 findMany 拖库。
 *  与 dev-token 同一套路：开关 + 环境/名单双条件。 */
export function assertCleanupAllowed(userId: string): void {
  if (process.env.CLEANUP_ORPHANS !== '1') {
    throw new ForbiddenException('清理接口默认关闭（需设 CLEANUP_ORPHANS=1）');
  }
  const admins = (process.env.CLEANUP_ADMINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // 未配名单时只在开发环境放行，方便本地自查；生产环境必须显式配名单
  if (!admins.length) {
    if (process.env.NODE_ENV === 'development') return;
    throw new ForbiddenException('未配置 CLEANUP_ADMINS 名单，生产环境不放行清理调用');
  }
  if (!admins.includes(userId)) {
    throw new ForbiddenException('当前用户不在清理名单内');
  }
}

@ApiTags('上传 Upload')
@Controller('api/v1/upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('cleanup-orphans')
  @ApiOperation({
    summary:
      '清理孤儿图片：未被任何物品引用、且上传已满 24h 的 uploads/ 文件。dryRun 默认 true 只报告，false 才真正删除（24h 内的新图受保护，避免删掉编辑中物品的图片）。⚠️ 运维接口：需 CLEANUP_ORPHANS=1 且在 CLEANUP_ADMINS 名单内，否则 403',
  })
  async cleanupOrphans(@Req() req, @Body() body: { dryRun?: boolean }) {
    assertCleanupAllowed(userIdFrom(req));
    const dryRun = body?.dryRun !== false;
    return this.uploadService.cleanOrphanImages(dryRun);
  }

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
