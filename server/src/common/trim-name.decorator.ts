/**
 * @author james-wu66
 * Findly 后端 · 2026-09-23（C16）
 *
 * name 类字段的入参归一：先 trim 再校验。
 * 单独存在的原因：class-validator 的 IsNotEmpty 只看长度不看内容（实测 '   ' 判为通过），
 * 不 trim 就允许"没有名字"的物品/空间写入库——物品从此搜不到，空间的路径也会显示成空白。
 */
import { Transform } from 'class-transformer';

export const TrimmedName = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
