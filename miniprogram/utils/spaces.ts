import { SpaceTree } from '../types/api'

export interface SpaceIconInfo {
  glyph: string
  card: string
}

/**
 * 根据空间名称及类型智能匹配图标与配色方案
 * 覆盖 7 大收纳空间体系
 */
export function matchSpaceIcon(name: string, type?: string | null): SpaceIconInfo {
  const n = (name || '').toLowerCase()
  const t = (type || '').toLowerCase()

  // 1. 收纳容器与桌柜家具优先（避免"书桌"误判为"书房"）
  if (t === 'container' || t === 'furniture' || n.includes('抽屉') || n.includes('盒') || n.includes('箱') || n.includes('柜') || n.includes('桌') || n.includes('架') || n.includes('夹') || n.includes('袋') || n.includes('包') || n.includes('栏')) {
    return { glyph: '/assets/spaces/glyphs/drawer.svg', card: '/assets/spaces/cards/drawer.svg' }
  }
  // 2. 公司 / 办公环境
  if (t === 'company' || n.includes('公司') || n.includes('办公') || n.includes('工位') || n.includes('单位') || n.includes('企业') || n.includes('基地') || n.includes('厂')) {
    return { glyph: '/assets/spaces/glyphs/company.svg', card: '/assets/spaces/cards/company.svg' }
  }
  // 3. 客厅 / 会客
  if (t === 'living_room' || n.includes('客') || n.includes('厅') || n.includes('沙发') || n.includes('阳台') || n.includes('堂')) {
    return { glyph: '/assets/spaces/glyphs/living_room.svg', card: '/assets/spaces/cards/living_room.svg' }
  }
  // 4. 卧室 / 休息
  if (t === 'bedroom' || n.includes('卧') || n.includes('床') || n.includes('次卧') || n.includes('主卧') || n.includes('衣帽') || n.includes('榻榻米')) {
    return { glyph: '/assets/spaces/glyphs/bedroom.svg', card: '/assets/spaces/cards/bedroom.svg' }
  }
  // 5. 书房 / 阅读
  if (t === 'study' || n.includes('书') || n.includes('读') || n.includes('阅') || n.includes('学') || n.includes('工作台')) {
    return { glyph: '/assets/spaces/glyphs/study.svg', card: '/assets/spaces/cards/study.svg' }
  }
  // 6. 家 / 住宅根空间
  if (t === 'home' || n.includes('家') || n.includes('住') || n.includes('屋') || n.includes('房产') || n.includes('宿舍') || n.includes('公寓')) {
    return { glyph: '/assets/spaces/glyphs/home.svg', card: '/assets/spaces/cards/home.svg' }
  }
  return { glyph: '/assets/spaces/glyphs/other_space.svg', card: '/assets/spaces/cards/other_space.svg' }
}

/**
 * 递归汇总节点及其所有后代空间的物品总数
 */
export function subtreeCount(node: SpaceTree): number {
  let sum = node.itemCount || 0
  for (const c of node.children || []) {
    sum += subtreeCount(c)
  }
  return sum
}
