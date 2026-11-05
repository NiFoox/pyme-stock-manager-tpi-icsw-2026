import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type publicUser } from './auth.service.js';

export type AuthenticatedRequest = Request & {
  user: ReturnType<typeof publicUser>;
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.auth.currentUser(request.session?.userId);
    return true;
  }
}
