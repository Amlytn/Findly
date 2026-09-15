/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16
 */
import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';

@Module({ controllers: [UploadController] })
export class UploadModule {}
