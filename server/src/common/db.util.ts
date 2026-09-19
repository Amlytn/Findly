/**
 * 数据库连接器探测。
 *
 * 本地联调用 SQLite（schema.prisma 的 provider 为工作区未提交改动），
 * 生产规划 PostgreSQL。Prisma 的 mode:'insensitive' 仅 PG/Mongo 支持，
 * SQLite 下会抛 Unknown argument 校验错误——关键词检索需按连接器降级。
 *
 * 必须是函数而非模块级常量：ConfigModule 的 dotenv 在各模块文件求值
 * 之后才加载 .env，常量会在求值期取到空 DATABASE_URL。
 */
export function isSqlite(): boolean {
  return (process.env.DATABASE_URL || '').startsWith('file:');
}
