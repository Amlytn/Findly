/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSpaceDto {
  @IsString() @IsNotEmpty() name: string;
  /** 父空间 id；不传则为根空间 */
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateSpaceDto {
  @IsOptional() @IsString() name?: string;
  /** 挪父级：会做环检测，不允许挪到自己的子孙下面 */
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}
