/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14
 */
import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import { SearchService } from './search.service';
import { userIdFrom } from '../common/user.util';

@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  get(@Req() req, @Query('q') q?: string) {
    if (!q || !q.trim()) throw new BadRequestException('缺少搜索词 q');
    return this.search.search(userIdFrom(req), q.trim());
  }
}
