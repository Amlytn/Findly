/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TrimmedName } from '../common/trim-name.decorator';

/** 空间类型：房间 / 家具 / 收纳容器 / 住宅根空间（前端图标选择器按类映射） */
export const SPACE_TYPES = ['home', 'room', 'furniture', 'container'] as const;

export class CreateSpaceDto {
  @TrimmedName() @IsString() @IsNotEmpty() name: string;
  /** 父空间 id；不传/传 null 均为根空间 */
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsIn(SPACE_TYPES) type?: (typeof SPACE_TYPES)[number];
  /** 语义图标 key；null 由前端按名称匹配兜底 */
  @IsOptional() @IsString() icon?: string | null;
}

export class UpdateSpaceDto {
  /** C16：与创建侧同规则，空串会把空间名清空、位置路径跟着坏掉 */
  @TrimmedName() @IsOptional() @IsString() @IsNotEmpty() name?: string;
  /** 挪父级：会做环检测，不允许挪到自己的子孙下面；null/空串 = 移回根级 */
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsIn(SPACE_TYPES) type?: (typeof SPACE_TYPES)[number];
  @IsOptional() @IsString() icon?: string | null;
}
