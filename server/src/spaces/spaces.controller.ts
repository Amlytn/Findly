/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SpacesService } from './spaces.service';
import { CreateSpaceDto, UpdateSpaceDto } from './dto';
import { userIdFrom } from '../common/user.util';

@ApiTags('空间 Spaces')
@Controller('api/v1/spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Get()
  list(@Req() req) {
    return this.spaces.list(userIdFrom(req));
  }

  @Post()
  create(@Req() req, @Body() dto: CreateSpaceDto) {
    return this.spaces.create(userIdFrom(req), dto);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateSpaceDto) {
    return this.spaces.update(userIdFrom(req), id, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.spaces.remove(userIdFrom(req), id);
  }
}
