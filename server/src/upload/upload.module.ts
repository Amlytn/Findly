/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16（B03 注册 UploadService 2026-09-20）
 */
import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({ controllers: [UploadController], providers: [UploadService] })
export class UploadModule {}
