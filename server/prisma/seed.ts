/**
 * @author james-wu66
 * Findly 后端 · 2026-09-14（2026-09-24 补：演示图与可重灌）
 */
// 演示数据：dev 用户 + 空间树 + 6 件带图物品。
// 运行：npm run seed        （库里已有 dev 数据时只提示，不动数据）
//       npm run seed -- --force   （先清掉 dev 的空间/物品/标签再重灌，录屏前想还原初始画面用）
//
// 图片为什么要拷一遍：前端 fullUrl() 只给含 /uploads/ 的路径追加 ?token=，
// 所以演示图必须落在 server/uploads/ 里才显示得出来；而 uploads/ 被 .gitignore 排除
// （真实用户上传不该进仓库）。素材直接复用 miniprogram/assets/ 里已有的演示物品图
// （README 注明"仅供测试填充使用"），seed 时拷进 uploads/ —— 不在仓库里存第二份二进制。
import { PrismaClient } from '@prisma/client';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const FORCE = process.argv.includes('--force');
const ASSET_DIR = join(process.cwd(), '..', 'miniprogram', 'assets');
const UPLOAD_DIR = join(process.cwd(), 'uploads');

/** 演示物品图（只拷这几张，banner/logo 那些不是物品图） */
const DEMO_IMAGES = [
  'item-mouse.jpg', 'item-cable.jpg', 'item-charger.jpg',
  'item-earbuds.jpg', 'item-backpack.jpg', 'item-camera.jpg',
];

/** 把演示图拷进 uploads/（已存在则跳过）。返回实际可用的文件名列表。 */
function stageDemoImages(): string[] {
  if (!existsSync(ASSET_DIR)) {
    console.warn(`⚠️ 没找到 ${ASSET_DIR}，本次 seed 的物品将没有图片`);
    return [];
  }
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  const usable: string[] = [];
  for (const name of DEMO_IMAGES) {
    const from = join(ASSET_DIR, name);
    if (!existsSync(from)) {
      console.warn(`⚠️ 缺素材 ${name}，对应物品将没有图片`);
      continue;
    }
    const to = join(UPLOAD_DIR, name);
    if (!existsSync(to)) copyFileSync(from, to);
    usable.push(name);
  }
  return usable;
}

async function clearDevData() {
  // 顺序不能反：ItemTag 有外键 RESTRICT，先解绑标签再删物品/标签
  await prisma.itemTag.deleteMany({ where: { item: { userId: 'dev' } } });
  await prisma.item.deleteMany({ where: { userId: 'dev' } });
  await prisma.tag.deleteMany({ where: { userId: 'dev' } });
  // 空间有 parentId 自引用外键，按"先子后父"删不掉深层节点，直接整批删
  await prisma.space.deleteMany({ where: { userId: 'dev' } });
}

async function main() {
  await prisma.user.upsert({
    where: { id: 'dev' },
    update: {},
    create: { id: 'dev', openid: 'dev-openid', nickname: '演示用户' },
  });

  const existing = await prisma.space.count({ where: { userId: 'dev' } });
  if (existing > 0) {
    if (!FORCE) {
      console.log(`dev 数据已存在（${existing} 个空间），跳过 seed。想还原初始画面：npm run seed -- --force`);
      return;
    }
    await clearDevData();
    console.log('--force：已清掉 dev 原有的空间/物品/标签，重新灌入');
  }

  const images = stageDemoImages();
  const img = (name: string) => (images.includes(name) ? `/uploads/${name}` : null);

  const home = await prisma.space.create({ data: { userId: 'dev', name: '我的家', type: 'home', icon: 'home' } });
  const study = await prisma.space.create({ data: { userId: 'dev', parentId: home.id, name: '书房', type: 'room', icon: 'study' } });
  const desk = await prisma.space.create({ data: { userId: 'dev', parentId: study.id, name: '书桌', type: 'furniture' } });
  const drawer = await prisma.space.create({ data: { userId: 'dev', parentId: desk.id, name: '右侧抽屉', type: 'container' } });
  const shelf = await prisma.space.create({ data: { userId: 'dev', parentId: study.id, name: '书柜二层', type: 'container' } });
  const living = await prisma.space.create({ data: { userId: 'dev', parentId: home.id, name: '客厅', type: 'room', icon: 'livingroom' } });

  const tag = (name: string) => ({
    tag: { connectOrCreate: { where: { userId_name: { userId: 'dev', name } }, create: { userId: 'dev', name } } },
  });

  const items = [
    { name: '白色无线鼠标', category: '电脑配件', brand: 'Logitech', model: 'MX Master 3S', color: '白色', spaceId: drawer.id, imageUrl: img('item-mouse.jpg'), description: '静音款，USB 接收器在同一个抽屉里', tags: ['鼠标', '无线', '办公'] },
    { name: '显示器 HDMI 线', category: '线材', brand: '绿联', color: '黑色', spaceId: shelf.id, imageUrl: img('item-cable.jpg'), description: '2 米，够到主机', tags: ['线材', 'HDMI'] },
    { name: '备用充电器', category: '数码配件', brand: '小米', color: '白色', spaceId: drawer.id, imageUrl: img('item-charger.jpg'), description: '67W 快充头 + C 口线', tags: ['充电器', '快充'] },
    { name: '无线耳机', category: '数码配件', brand: 'Sony', model: 'WF-1000XM4', color: '黑色', spaceId: desk.id, imageUrl: img('item-earbuds.jpg'), description: '降噪，通勤用', tags: ['耳机', '降噪', '通勤'] },
    { name: '通勤背包', category: '箱包', brand: '小米', color: '灰色', spaceId: living.id, imageUrl: img('item-backpack.jpg'), description: '装 15.6 寸笔记本', tags: ['背包', '通勤'] },
    { name: '微单相机', category: '摄影', brand: 'Sony', model: 'A6400', color: '黑色', spaceId: shelf.id, imageUrl: img('item-camera.jpg'), description: '镜头盖要一起放', tags: ['相机', '爱好'] },
  ];

  for (const it of items) {
    await prisma.item.create({
      data: {
        userId: 'dev',
        name: it.name,
        category: it.category,
        brand: it.brand,
        model: (it as any).model ?? null,
        color: it.color,
        description: it.description,
        spaceId: it.spaceId,
        imageUrl: it.imageUrl,
        tags: { create: it.tags.map(tag) },
      },
    });
  }

  console.log(
    `seed 完成：dev 用户 / 6 个空间（4 层树）/ ${items.length} 件物品` +
    `（其中 ${items.filter((i) => i.imageUrl).length} 件带图）`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
