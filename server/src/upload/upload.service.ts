/**
 * @author james-wu66
 * Findly 后端 · 2026-09-20（B03：孤儿图片清理）
 *
 * 孤儿图片 = uploads/ 目录下、未被任何 Item 的 imageUrl / thumbnailUrl 引用的图片文件。
 * AIResult 不落盘图片（recognize 用 base64 dataURL 直传模型），故只查 Item。
 */
import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';
import { readdir, unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';

// 与 upload.controller.ts 的 ALLOW 保持一致（magic bytes 已在落盘时校验过，这里仅按扩展名过滤）
const UPLOAD_DIR = join(process.cwd(), 'uploads');
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export interface OrphanResult {
  scanned: number; // uploads/ 下图片文件总数
  referenced: number; // 被 Item 引用的图片数（去重后）
  orphans: string[]; // 孤儿文件名列表
  deleted: number; // 实际删除数（dryRun=true 时为 0）
  dryRun: boolean;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private prisma: PrismaService) {}

  /** 取出所有 Item（含软删除）引用的图片文件名集合，避免误删仍被引用的文件。
   * 保守策略：软删除物品引用的图片也视为"在用"。
   * 若希望软删除物品后也立即回收其图片，把下面 findMany 加上 where: { deletedAt: null } 即可。 */
  private async referencedImageNames(): Promise<Set<string>> {
    const items = await this.prisma.item.findMany({
      select: { imageUrl: true, thumbnailUrl: true },
    });
    const names = new Set<string>();
    for (const it of items) {
      for (const url of [it.imageUrl, it.thumbnailUrl]) {
        if (!url) continue;
        const base = url.split('/').pop();
        if (base) names.add(base);
      }
    }
    return names;
  }

  /**
   * 清理孤儿图片。
   * @param dryRun 默认 true：只报告孤儿，不删文件。显式传 false 才真正删除。
   */
  async cleanOrphanImages(dryRun = true): Promise<OrphanResult> {
    if (!existsSync(UPLOAD_DIR)) {
      return { scanned: 0, referenced: 0, orphans: [], deleted: 0, dryRun };
    }
    const files = (await readdir(UPLOAD_DIR)).filter((f) => {
      const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
      return IMAGE_EXT.has(ext);
    });
    const referenced = await this.referencedImageNames();
    const orphans = files.filter((f) => !referenced.has(f)).sort();

    let deleted = 0;
    if (!dryRun) {
      for (const f of orphans) {
        try {
          await unlink(join(UPLOAD_DIR, f));
          deleted += 1;
        } catch (e) {
          this.logger.warn(`删除孤儿图片失败 ${f}: ${e?.message ?? e}`);
        }
      }
    }
    return { scanned: files.length, referenced: referenced.size, orphans, deleted, dryRun };
  }
}
