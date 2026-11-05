import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionStore } from './session-store.js';
import { LoginThrottleGuard } from './login-throttle.guard.js';
import { SessionAuthGuard } from './session-auth.guard.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, SessionStore, LoginThrottleGuard, SessionAuthGuard],
  exports: [SessionStore, AuthService, SessionAuthGuard],
})
export class IdentityModule {}
