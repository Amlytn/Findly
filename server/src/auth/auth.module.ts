/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({
    secret: process.env.JWT_SECRET || 'findly-dev-secret', // M5 强制使用环境变量
    signOptions: { expiresIn: '7d' },
  })],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
