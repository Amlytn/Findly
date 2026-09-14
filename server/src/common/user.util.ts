/** 从请求头取用户 id（本阶段演示用；微信登录接入后替换为 token 解析） */
export function userIdFrom(req: any): string {
  return (req.headers?.['x-user-id'] as string) || 'dev';
}
