/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
import { ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TrimmedName } from '../common/trim-name.decorator';

export class CreateItemDto {
  @TrimmedName() @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() spaceId?: string | null;
  @IsOptional() @IsString() imageUrl?: string;
  /** 整体设置标签（POST 时创建；userId+name 唯一防重复） */
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
  /** 识别结果页保存时带回的 AIResult id，用于回填 AIResult.itemId（契约 v1.2） */
  @IsOptional() @IsString() aiResultId?: string;
}

export class UpdateItemDto {
  /** C16：更新侧要与创建侧同规则。缺 @IsNotEmpty 时 {"name":""} 会把名字清空，
   *  该物品从此搜不到（name 是关键词匹配的五个字段之一），且界面上看着像坏数据 */
  @TrimmedName() @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  /** null / 空串 = 解绑位置（移回"未归位"）；不传 = 不动 */
  @IsOptional() @IsString() spaceId?: string | null;
  @IsOptional() @IsString() imageUrl?: string;
  /** 传了就整体替换（先解绑旧标签再绑定新标签，事务内完成）；不传不动标签 */
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
}

export class QueryItemsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() spaceId?: string;
  /** 分类精确筛选（分类 chips 用；区别于 keyword 模糊检索） */
  @IsOptional() @IsString() category?: string;
}
