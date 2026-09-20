/**
 * 列表卡片视图字段的唯一映射器：img / meta / space / zone / count 只在此处派生。
 * 注意：不在此处给契约缺失字段补默认值（那会把契约缺陷变成看不见的显示问题）。
 */
import { fullUrl } from '../services/config'
import type { ItemListItem } from '../types/api'
import { serverPathLeaf, toDisplayPath } from './space-path'

export interface ItemCardVM extends Omit<ItemListItem, 'space'> {
  /** 展示用图片：相对路径补全，无图落 logo */
  img: string
  /** color · brand（null 过滤，可能为空串） */
  meta: string
  /** 空间短名，无空间为「未归位」 */
  space: string
  /** 完整位置路径（显示样式，可能为空串） */
  zone: string
  /** 数量，缺省 1 */
  count: number
}

export function mapItemCard(it: ItemListItem): ItemCardVM {
  return Object.assign({}, it, {
    img: fullUrl(it.imageUrl) || '/assets/logo.png',
    meta: [it.color, it.brand].filter(Boolean).join(' · '),
    // 物品列表接口带 space 对象；搜索结果只有 path（契约差异），故以 path 末级兜底
    space: it.space ? it.space.name : (serverPathLeaf(it.path) || '未归位'),
    zone: toDisplayPath(it.path),
    count: it.quantity || 1
  })
}

/** 图片 binderror 兜底：替换第 idx 条的展示图为 logo（控制台留痕，避免静默掩盖真实失败） */
export function fallbackImg<T extends { img: string }>(list: T[], idx: number): T[] {
  const item = list[idx]
  if (!item) return list
  console.warn('[findly] image load failed:', item.img)
  const next = list.slice()
  next[idx] = Object.assign({}, item, { img: '/assets/logo.png' })
  return next
}
