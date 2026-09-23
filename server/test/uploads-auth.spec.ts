/**
 * @author james-wu66
 * C22 + C18：/uploads/ 守卫的单元测试（凭证校验 / 下游异常归属 / 访问日志）
 * 不起 Nest、不连库：jwtService 与 logger 都是假的
 */
import { uploadsAuthGuard } from '../src/common/uploads-auth';

const TOKEN = 'a-real-looking.jwt.value';

function makeRes() {
  const handlers: Record<string, () => void> = {};
  return {
    statusCode: 200,
    status: jest.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn().mockReturnThis(),
    on: jest.fn((ev: string, cb: () => void) => {
      handlers[ev] = cb;
    }),
    fireFinish: () => handlers.finish && handlers.finish(),
    hasFinishHandler: () => !!handlers.finish,
  };
}

describe('/uploads/ 守卫', () => {
  let jwt: any;
  let logger: any;
  let mw: any;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1' }) };
    logger = { log: jest.fn(), warn: jest.fn() };
    mw = uploadsAuthGuard(jwt, logger);
  });

  /** 真实挂载式中间件里 express 的行为：req.path 被剥掉 '/uploads/' 前缀，originalUrl 才是全路径（且带 query） */
  const reqWith = (over: any = {}) =>
    Object.assign(
      { method: 'GET', path: '/a.jpg', originalUrl: '/uploads/a.jpg', headers: {} },
      over,
    );

  it('带有效 Bearer → 放行，不回 401', async () => {
    const res = makeRes();
    const next = jest.fn();
    await mw(reqWith({ headers: { authorization: 'Bearer ' + TOKEN } }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('用 ?token= 传凭证同样放行（小程序 <image> 发不出 header）', async () => {
    const res = makeRes();
    const next = jest.fn();
    await mw(reqWith({ query: { token: TOKEN } }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(jwt.verifyAsync).toHaveBeenCalledWith(TOKEN);
  });

  it('完全没有凭证 → 401 且不调用 next', async () => {
    const res = makeRes();
    const next = jest.fn();
    await mw(reqWith(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: '图片访问需登录凭证' }));
  });

  it('验签失败（乱 token/过期）→ 401，而不是 500', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt malformed'));
    const res = makeRes();
    const next = jest.fn();
    await mw(reqWith({ headers: { authorization: 'Bearer garbage' } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // C22 核心：下游抛的错误不能被伪装成"凭证问题"
  it('C22：next() 抛错时错误交回 Express 错误链，且没有回 401', async () => {
    const boom = new Error('ENOENT: 静态服务炸了');
    const res = makeRes();
    // 只让第一次 next()（放行下游）抛错；第二次是 next(err) 转交错误链，不该再抛
    const next: any = jest.fn().mockImplementationOnce(() => {
      throw boom;
    });
    await mw(reqWith({ headers: { authorization: 'Bearer ' + TOKEN } }), res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(next.mock.calls[1][0]).toBe(boom); // 原对象交回去，原因不丢
    expect(res.status).not.toHaveBeenCalled();
  });

  // C18：图片访问此前 0 条日志
  it('C18：成功访问会注册 finish 回调，日志含用户与路径', async () => {
    const res = makeRes();
    await mw(reqWith({ headers: { authorization: 'Bearer ' + TOKEN } }), res, jest.fn());
    expect(res.hasFinishHandler()).toBe(true);
    res.statusCode = 200;
    res.fireFinish();
    const line = logger.log.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(line).toContain('u1');
    expect(line).toContain('/uploads/a.jpg');
    expect(line).toContain('200');
  });

  it('C18：日志里绝不出现 token 原文（?token= 走的是 query，只记 path 不记 originalUrl）', async () => {
    const res = makeRes();
    await mw(
      reqWith({ query: { token: TOKEN }, originalUrl: '/uploads/a.jpg?token=' + TOKEN }),
      res,
      jest.fn(),
    );
    res.fireFinish();
    const all = logger.log.mock.calls.concat(logger.warn.mock.calls).map((c: any[]) => c.join(' ')).join('\n');
    expect(all).not.toContain(TOKEN);
    expect(all).not.toContain('token=');
    expect(all).toContain('/uploads/a.jpg');
  });

  it('C18：被拒的访问也留一行 warn', async () => {
    const res = makeRes();
    await mw(reqWith({ originalUrl: '/uploads/x.jpg?token=' + TOKEN }), res, jest.fn());
    const line = logger.warn.mock.calls.map((c: any[]) => c.join(' ')).join('');
    expect(line).toContain('401');
    expect(line).not.toContain(TOKEN);
  });
});
