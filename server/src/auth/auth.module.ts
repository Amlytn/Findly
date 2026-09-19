/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16（M5 收紧 2026-09-19）
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      // 工厂在 DI 实例化时执行（此时 ConfigModule 已加载 .env），
      // 秘钥缺失直接拒绝启动——禁止使用内置回退密钥（M5 安全要求）
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET 未配置：为防止伪造 token，服务拒绝以回退密钥启动');
        }
        return { secret, signOptions: { expiresIn: '7d' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
