/**
 * @author james-wu66
 * AllExceptionsFilter 单元测试（B04）
 *
 * 核心保证：业务异常原样透传（前端已依赖现有文案）、未知异常不外泄内部信息。
 */
import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

function mockHost(url = '/api/v1/items?page=1') {
  const req: any = { method: 'GET', originalUrl: url };
  const res: any = { statusCode: 200, status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const host: any = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  };
  return { host: host as ArgumentsHost, res };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  describe('业务异常原样透传（硬要求：前端已依赖现有文案）', () => {
    it('BadRequestException：状态码 400、message 保持原值、error 为 Bad Request', () => {
      const { host, res } = mockHost();
      filter.catch(new BadRequestException('空间不存在或不属于当前用户'), host);

      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('空间不存在或不属于当前用户');
      expect(body.error).toBe('Bad Request');
    });

    it('校验失败时 message 是数组，同样原样返回', () => {
      const { host, res } = mockHost();
      filter.catch(new BadRequestException(['pageSize must not be greater than 100']), host);

      const body = res.json.mock.calls[0][0];
      expect(Array.isArray(body.message)).toBe(true);
      expect(body.message[0]).toContain('pageSize');
    });

    it('404 也透传', () => {
      const { host, res } = mockHost();
      filter.catch(new HttpException('物品不存在', HttpStatus.NOT_FOUND), host);

      expect(res.status).toHaveBeenCalledWith(404);
      const body = res.json.mock.calls[0][0];
      expect(body.statusCode).toBe(404);
      expect(body.message).toBe('物品不存在');
      expect(body.error).toBe('Not Found');
    });

    it('429 限流也透传（文案由 @nestjs/throttler 提供）', () => {
      const { host, res } = mockHost();
      filter.catch(new HttpException('ThrottlerException: Too Many Requests', 429), host);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json.mock.calls[0][0].error).toBe('Too Many Requests');
    });
  });

  describe('未知异常统一转 500 且不外泄内部信息', () => {
    it('普通 Error → 500 + 固定友好文案', () => {
      const { host, res } = mockHost();
      filter.catch(new Error('connect ECONNREFUSED 127.0.0.1:5432'), host);

      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.statusCode).toBe(500);
      expect(body.message).toBe('服务器内部错误，请稍后重试');
    });

    it('原始错误信息不出现在响应体里', () => {
      const { host, res } = mockHost();
      filter.catch(new Error('连接数据库失败：password=secret123'), host);

      const serialized = JSON.stringify(res.json.mock.calls[0][0]);
      expect(serialized).not.toContain('secret123');
      expect(serialized).not.toContain('ECONNREFUSED');
      expect(serialized).not.toContain('连接数据库失败');
    });

    it('非 Error 类型（如抛字符串）也能兜住', () => {
      const { host, res } = mockHost();
      filter.catch('随便抛了个字符串', host);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json.mock.calls[0][0].message).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('响应体结构', () => {
    it('含 path 与合法的 ISO timestamp', () => {
      const { host, res } = mockHost('/api/v1/not-exist');
      filter.catch(new HttpException('Cannot GET', 404), host);

      const body = res.json.mock.calls[0][0];
      expect(body.path).toBe('/api/v1/not-exist');
      expect(typeof body.timestamp).toBe('string');
      expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('五个字段齐全', () => {
      const { host, res } = mockHost();
      filter.catch(new Error('boom'), host);

      const body = res.json.mock.calls[0][0];
      expect(Object.keys(body).sort()).toEqual(
        ['error', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });
  });
});
