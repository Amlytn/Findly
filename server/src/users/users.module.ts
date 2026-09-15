/**
 * @author james-wu66
 * Findly 后端 · 2026-09-16
 */
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';

@Module({ controllers: [UsersController] })
export class UsersModule {}
