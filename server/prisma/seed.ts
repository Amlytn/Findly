// 演示数据：dev 用户 + 空间树 + 3 件物品。可重复执行（已存在则跳过）。
// 运行：npm run seed
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { id: 'dev' },
    update: {},
    create: { id: 'dev', openid: 'dev-openid', nickname: '演示用户' },
  });

  const existing = await prisma.space.count({ where: { userId: 'dev' } });
  if (existing > 0) {
    console.log('dev 数据已存在，跳过 seed');
    return;
  }

  const home = await prisma.space.create({ data: { userId: 'dev', name: '我的家' } });
  const study = await prisma.space.create({ data: { userId: 'dev', parentId: home.id, name: '书房' } });
  const desk = await prisma.space.create({ data: { userId: 'dev', parentId: study.id, name: '书桌' } });
  const drawer = await prisma.space.create({ data: { userId: 'dev', parentId: desk.id, name: '右侧抽屉' } });
  const shelf = await prisma.space.create({ data: { userId: 'dev', parentId: study.id, name: '书柜二层' } });

  const tag = (name: string) => ({
    tag: { connectOrCreate: { where: { userId_name: { userId: 'dev', name } }, create: { userId: 'dev', name } } },
  });

  await prisma.item.create({
    data: { userId: 'dev', name: '白色无线鼠标', category: '电脑配件', brand: 'Logitech', model: 'MX Master 3S', color: '白色', spaceId: drawer.id, tags: { create: [tag('鼠标'), tag('无线'), tag('办公')] } },
  });
  await prisma.item.create({
    data: { userId: 'dev', name: '显示器 HDMI 线', category: '线材', brand: '绿联', color: '黑色', spaceId: shelf.id, tags: { create: [tag('线材'), tag('HDMI')] } },
  });
  await prisma.item.create({
    data: { userId: 'dev', name: '备用充电器', category: '数码配件', brand: '小米', color: '白色', spaceId: drawer.id, tags: { create: [tag('充电器'), tag('快充')] } },
  });

  console.log('seed 完成：dev 用户 / 5 个空间 / 3 件物品');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
