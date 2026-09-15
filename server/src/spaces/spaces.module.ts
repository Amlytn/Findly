/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
import { Module } from '@nestjs/common';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  controllers: [SpacesController],
  providers: [SpacesService],
})
export class SpacesModule {}
