/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto, QueryItemsDto, UpdateItemDto } from './dto';
import { userIdFrom } from '../common/user.util';

// 注意：GET categories 是静态路径，必须声明在 GET :id 之前，否则会被当成 :id 解析
@Controller('api/v1/items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  list(@Req() req, @Query() q: QueryItemsDto) {
    return this.items.list(userIdFrom(req), q);
  }

  @Post()
  create(@Req() req, @Body() dto: CreateItemDto) {
    return this.items.create(userIdFrom(req), dto);
  }

  @Get('categories')
  categories(@Req() req) {
    return this.items.categories(userIdFrom(req));
  }

  @Get(':id/related')
  related(@Req() req, @Param('id') id: string) {
    return this.items.related(userIdFrom(req), id);
  }

  @Get(':id')
  detail(@Req() req, @Param('id') id: string) {
    return this.items.detail(userIdFrom(req), id);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.items.update(userIdFrom(req), id, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.items.remove(userIdFrom(req), id);
  }
}
