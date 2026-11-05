import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';
import { LoginThrottleGuard } from './login-throttle.guard.js';
import { SESSION_COOKIE } from './auth-config.js';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from './session-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(LoginThrottleGuard)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.auth.login(dto);
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    );
    return user;
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    res.clearCookie(SESSION_COOKIE, {
      path: '/api',
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || process.env.NODE_ENV === 'production',
    });
  }
}
