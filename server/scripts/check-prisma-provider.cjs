/**
 * @author james-wu66
 * Findly 后端 · 2026-09-23（S1）
 *
 * 校验 schema.prisma 的 datasource provider 与 prisma/migrations/migration_lock.toml 一致。
 *
 * 为什么要单独写这个：2026-09-21 的事故是队友把 `provider` 提交成了 `sqlite`，
 * 而三份迁移全是 PostgreSQL 方言 ⇒ main 上后端直接起不来。CI 当时全绿，
 * 因为单元测试把 Prisma 整个 mock 掉了，构建阶段又只做 `prisma generate`。
 *
 * 而 `npx prisma validate` 只挡得住一半（09-23 实测）：
 *   provider=sqlite + postgres 的 DATABASE_URL ⇒ 退出码 1（抓得住，就是事故当时的形态）；
 *   provider=sqlite + `file:` URL            ⇒ 退出码 0（**放过**，哪怕迁移全是 PG 方言）。
 * 所以这条比对是 validate 之外的第二道，专门补那个洞。
 *
 * 已知仍未覆盖的：provider 一致但 schema 与迁移不同步（drift）。
 * 那个要 `prisma migrate diff --from-migrations ... --shadow-database-url ...`，
 * 需要一个真数据库当影子库，CI 里得起 service container —— 属另一件事，不在本脚本范围。
 */
const fs = require('fs');
const path = require('path');

const PRISMA_DIR = path.join(__dirname, '..', 'prisma');
const SCHEMA = path.join(PRISMA_DIR, 'schema.prisma');
const LOCK = path.join(PRISMA_DIR, 'migrations', 'migration_lock.toml');

/** 取 datasource 块里的 provider。
 *  不能直接匹配第一个 `provider = "..."` —— schema.prisma 里 generator 块在前，
 *  那一句是 `provider = "prisma-client-js"`，匹配到它就等于永远比不出真相。 */
function datasourceProvider(schemaText) {
  const m = schemaText.match(/datasource\s+\w+\s*\{[^}]*?provider\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function lockProvider(lockText) {
  const m = lockText.match(/^\s*provider\s*=\s*"([^"]+)"/m);
  return m ? m[1] : null;
}

function main() {
  if (!fs.existsSync(SCHEMA)) { console.error('找不到 ' + SCHEMA); process.exit(1); }
  if (!fs.existsSync(LOCK)) {
    // 还没有任何迁移时不该报错（新项目状态），只提示
    console.log('prisma/migrations/migration_lock.toml 不存在：暂无迁移，跳过 provider 一致性比对');
    return;
  }
  const a = datasourceProvider(fs.readFileSync(SCHEMA, 'utf8'));
  const b = lockProvider(fs.readFileSync(LOCK, 'utf8'));

  if (!a) { console.error('schema.prisma 里没找到 datasource 块的 provider（写法变了？检查正则）'); process.exit(1); }
  if (!b) { console.error('migration_lock.toml 里没找到 provider（文件被改坏了？）'); process.exit(1); }

  if (a !== b) {
    console.error(
      'provider 不一致：schema.prisma 是 ' + a + '，但迁移是在 ' + b + ' 下生成的。\n' +
      '  ⇒ 迁移 SQL 用的是 ' + b + ' 方言，切到 ' + a + ' 后 `migrate deploy` 会失败、后端起不来。\n' +
      '  ⇒ 09-21 事故就是这个形状（provider 被误提交成 sqlite）。要换库必须连迁移一起重做，不能只改这一行。',
    );
    process.exit(1);
  }
  console.log('provider 一致：' + a + '（schema 与 migration_lock 对得上）');
}

main();
