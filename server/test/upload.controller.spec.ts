/**
 * @author james-wu66
 * C17：孤儿图片清理接口的权限门（破坏性运维接口默认关闭）
 * 只测守卫函数本身，不起 Nest 实例、不碰文件系统
 */
import { ForbiddenException } from '@nestjs/common';
import { assertCleanupAllowed } from '../src/upload/upload.controller';

describe('C17 cleanup-orphans 权限门', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('默认关闭：没设 CLEANUP_ORPHANS=1 时任何人调用都 403', () => {
    delete process.env.CLEANUP_ORPHANS;
    delete process.env.CLEANUP_ADMINS;
    process.env.NODE_ENV = 'development';
    expect(() => assertCleanupAllowed('dev')).toThrow(ForbiddenException);
    expect(() => assertCleanupAllowed('dev')).toThrow(/CLEANUP_ORPHANS/);
  });

  it('开了开关但没配名单：开发环境放行（本地自查），生产环境 403', () => {
    process.env.CLEANUP_ORPHANS = '1';
    delete process.env.CLEANUP_ADMINS;
    process.env.NODE_ENV = 'development';
    expect(() => assertCleanupAllowed('dev')).not.toThrow();
    process.env.NODE_ENV = 'production';
    expect(() => assertCleanupAllowed('dev')).toThrow(/CLEANUP_ADMINS/);
  });

  it('配了名单：名单外 403，名单内放行（名单比对前后空白容错）', () => {
    process.env.CLEANUP_ORPHANS = '1';
    process.env.NODE_ENV = 'production';
    process.env.CLEANUP_ADMINS = 'admin_1, dev';
    expect(() => assertCleanupAllowed('someone-else')).toThrow(ForbiddenException);
    expect(() => assertCleanupAllowed('dev')).not.toThrow();
  });
});
