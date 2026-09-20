/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { userIdFrom } from '../common/user.util';

@ApiTags('搜索 Search')
@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  get(
    @Req() req,
    @Query('q') q?: string,
    @Query('type') type?: string,
  ) {
    if (!q || !q.trim()) throw new BadRequestException('缺少搜索词 q');
    const t = (type || 'all') as 'all' | 'item' | 'space';
    if (!['all', 'item', 'space'].includes(t))
      throw new BadRequestException('type 必须是 all/item/space');
    return this.search.search(userIdFrom(req), q.trim(), t);
  }

  @Get('suggestions')
  suggestions(@Req() req) {
    return this.search.suggestions(userIdFrom(req));
  }
}
