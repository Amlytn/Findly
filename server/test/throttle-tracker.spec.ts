/**
 * @author james-wu66
 * C19：限流分桶键（经 nginx 后不能只按 IP）
 */
import { throttleTracker } from '../src/common/throttle-tracker';

describe('C19 throttleTracker', () => {
  it('带 Authorization 时按凭证分桶：同一账号稳定同键，不同账号不同键', () => {
    const a = throttleTracker({ headers: { authorization: 'Bearer tokenA' }, ip: '1.1.1.1' });
    const a2 = throttleTracker({ headers: { authorization: 'Bearer tokenA' }, ip: '9.9.9.9' });
    const b = throttleTracker({ headers: { authorization: 'Bearer tokenB' }, ip: '1.1.1.1' });
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
    expect(a.startsWith('tok:')).toBe(true);
  });

  it('同一账号换出口 IP（家里 wifi → 蜂窝）仍是同一个桶', () => {
    expect(throttleTracker({ headers: { authorization: 'Bearer t' }, ip: '10.0.0.1' })).toBe(
      throttleTracker({ headers: { authorization: 'Bearer t' }, ip: '172.16.0.9' }),
    );
  });

  it('不带凭证的匿名流量回落 IP，保住对垃圾请求的兜底', () => {
    expect(throttleTracker({ headers: {}, ip: '2.2.2.2' })).toBe('ip:2.2.2.2');
    expect(throttleTracker({ headers: { authorization: '' }, ip: '2.2.2.2' })).toBe('ip:2.2.2.2');
    expect(throttleTracker({})).toBe('ip:unknown');
  });

  it('桶键里不出现明文 token', () => {
    const key = throttleTracker({ headers: { authorization: 'Bearer super-secret-jwt' }, ip: '1.1.1.1' });
    expect(key).not.toContain('super-secret-jwt');
    expect(key.length).toBeLessThanOrEqual(25);
  });
});
