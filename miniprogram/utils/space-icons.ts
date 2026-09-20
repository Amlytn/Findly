/**
 * 空间图标注册表 —— icon key → 展示定义（路径 / 名称 / 归属类型）
 *
 * - key 与后端 Space.icon 字段语义对齐，这里是一份权威登记：
 *   图标选择器从这里取全部候选；渲染时由 utils/spaces.ts resolveSpaceIcon 消费。
 * - 新增图标：补 SVG 到 assets/spaces/{cards,glyphs}/ + 在本表登记一行。
 * - type 由所选图标自动映射（后端字段 home/room/furniture/container）。
 */
import { SpaceType } from '../types/api'

export interface SpaceIconDef {
  key: string
  /** 展示名（选择器网格里显示） */
  label: string
  /** 归属类型：选中该图标时自动填写的 Space.type */
  type: SpaceType
}

export interface SpaceIconCategory {
  id: string
  label: string
  icons: SpaceIconDef[]
}

/** 图标类别列表（选择器 tab 顺序即此） */
export const ICON_CATEGORIES: SpaceIconCategory[] = [
  {
    id: 'room',
    label: '居所',
    icons: [
      { key: 'home', label: '家', type: 'home' },
      { key: 'living_room', label: '客厅', type: 'room' },
      { key: 'bedroom', label: '卧室', type: 'room' },
      { key: 'study', label: '书房', type: 'room' },
      { key: 'kitchen', label: '厨房', type: 'room' },
      { key: 'bathroom', label: '卫生间', type: 'room' },
      { key: 'balcony', label: '阳台', type: 'room' }
    ]
  },
  {
    id: 'storage',
    label: '收纳',
    icons: [
      { key: 'storage', label: '储物间', type: 'room' },
      { key: 'garage', label: '车库', type: 'room' },
      { key: 'basement', label: '地下室', type: 'room' },
      { key: 'wardrobe', label: '衣柜', type: 'furniture' },
      { key: 'drawer', label: '抽屉', type: 'container' },
      { key: 'bookshelf', label: '书架', type: 'furniture' }
    ]
  },
  {
    id: 'furniture',
    label: '桌柜',
    icons: [
      { key: 'desk', label: '书桌', type: 'furniture' },
      { key: 'cabinet', label: '柜子', type: 'furniture' },
      { key: 'shelf', label: '置物架', type: 'furniture' }
    ]
  },
  {
    id: 'work',
    label: '办公',
    icons: [
      { key: 'company', label: '公司', type: 'room' },
      { key: 'office', label: '办公室', type: 'room' },
      { key: 'warehouse', label: '仓库', type: 'room' }
    ]
  },
  {
    id: 'other',
    label: '其他',
    icons: [
      { key: 'car', label: '车里', type: 'container' },
      { key: 'backpack', label: '背包', type: 'container' },
      { key: 'other', label: '其他', type: 'room' }
    ]
  }
]

/** 展平全部图标定义（选择器"全部"视图 / key 校验用） */
export const ALL_ICONS: SpaceIconDef[] = (function () {
  const out: SpaceIconDef[] = []
  for (const c of ICON_CATEGORIES) out.push(...c.icons)
  return out
})()

/** 由 key 取图标定义；未知 key 返回 null（调用方回退名称匹配） */
export function findIconDef(key?: string | null): SpaceIconDef | null {
  if (!key) return null
  return ALL_ICONS.find(function (d) { return d.key === key }) || null
}