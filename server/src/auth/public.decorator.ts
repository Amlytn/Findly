/**
 * @author Amlytn
 * Findly 后端 · 2026-09-19（M5 鉴权收紧配套）
 *
 * 标记无需登录的路由（登录、联调通道本身不能要求凭证）。
 * JwtAuthGuard 通过 Reflector 读取该元数据放行。
 */
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
