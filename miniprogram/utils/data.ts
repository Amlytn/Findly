/**
 * 共享模拟数据层
 * 实际项目中替换为云开发 / 后端接口即可，页面只依赖这里导出的结构。
 */

export interface Item {
  id: number
  name: string
  img: string
  brand: string
  category: string
  color: string
  desc: string
  space: string
  zone: string
  count: number
  cat: 'digital' | 'life' | 'book'
}

export const ITEMS: Item[] = [
  { id: 1, name: '无线鼠标', img: '/assets/item-mouse.jpg', brand: 'Logitech', category: '电脑配件', color: '白色', desc: '无线蓝牙鼠标，适用于办公、学习等场景', space: '书房', zone: '书桌', count: 1, cat: 'digital' },
  { id: 2, name: '相机', img: '/assets/item-camera.jpg', brand: 'Sony', category: '摄影器材', color: '黑色', desc: '全画幅微单相机，配标准变焦镜头', space: '客厅', zone: '电视柜', count: 1, cat: 'digital' },
  { id: 3, name: '耳机', img: '/assets/item-headphone.jpg', brand: 'Sony', category: '影音设备', color: '黑色', desc: '头戴式降噪耳机，适合通勤与影音', space: '卧室', zone: '床头柜', count: 1, cat: 'digital' },
  { id: 4, name: '无线耳机', img: '/assets/item-earbuds.jpg', brand: 'Sony', category: '影音设备', color: '白色', desc: '真无线蓝牙耳机，含充电仓', space: '书房', zone: '书桌抽屉', count: 1, cat: 'digital' },
  { id: 5, name: '备用充电器', img: '/assets/item-charger.jpg', brand: 'Anker', category: '充电配件', color: '白色', desc: '双口快充充电头，65W', space: '客厅', zone: '电视柜抽屉', count: 1, cat: 'digital' },
  { id: 6, name: '数据线', img: '/assets/item-cable.jpg', brand: 'Anker', category: '充电配件', color: '白色', desc: '1.5m 编织快充数据线', space: '客厅', zone: '电视柜抽屉', count: 1, cat: 'life' },
  { id: 7, name: '鼠标垫', img: '/assets/item-mousepad.jpg', brand: '小米', category: '电脑配件', color: '黑色', desc: '大尺寸布面鼠标垫', space: '书房', zone: '书桌', count: 1, cat: 'life' },
  { id: 8, name: '背包', img: '/assets/item-backpack.jpg', brand: '小米', category: '箱包', color: '黑色', desc: '通勤双肩包，20L', space: '储物间', zone: '挂衣区', count: 1, cat: 'life' },
  { id: 9, name: '《三体》', img: '/assets/item-book.jpg', brand: '重庆出版社', category: '书籍', color: '蓝色', desc: '刘慈欣科幻长篇小说，第一部', space: '书房', zone: '书架', count: 1, cat: 'book' }
]

export const CATS = [
  { key: 'all', name: '全部' },
  { key: 'digital', name: '电子产品' },
  { key: 'life', name: '生活用品' },
  { key: 'book', name: '书籍' }
]

export interface Space {
  name: string
  icon: string
  zones: number
  items: number
}

export const SPACES: Space[] = [
  { name: '我的家', icon: 'house', zones: 4, items: 12 },
  { name: '书房', icon: 'book', zones: 2, items: 3 },
  { name: '客厅', icon: 'sofa', zones: 2, items: 4 },
  { name: '卧室', icon: 'bed', zones: 1, items: 2 },
  { name: '储物间', icon: 'box', zones: 1, items: 3 }
]

export const SUGGESTIONS = [
  '我的黑色背包在哪里？',
  '黑色双肩包',
  '小米背包',
  '索尼耳机怎么样',
  '蓝牙耳机推荐',
  '白色耳机在哪里'
]

export function findItem(id: number): Item | undefined {
  return ITEMS.find(function (i) { return i.id === id })
}

export function catCount(key: string): number {
  if (key === 'all') return ITEMS.length
  return ITEMS.filter(function (i) { return i.cat === key }).length
}

/** 关键词匹配：名称 / 品牌 / 颜色 / 分类 / 描述 */
export function searchItems(kw: string): Item[] {
  const k = (kw || '').trim().toLowerCase()
  if (!k) return ITEMS.slice()
  return ITEMS.filter(function (i) {
    return (i.name + i.brand + i.color + i.category + i.desc + i.space + i.zone)
      .toLowerCase().indexOf(k) >= 0
  })
}

export function searchSpaces(kw: string): Space[] {
  const k = (kw || '').trim()
  if (!k) return SPACES.slice()
  return SPACES.filter(function (s) { return s.name.indexOf(k) >= 0 })
}
