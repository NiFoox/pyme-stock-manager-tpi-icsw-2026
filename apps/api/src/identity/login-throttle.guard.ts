import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();

  canActivate(context: ExecutionContext): boolean {
    const now = Date.now();
    for (const [key, entry] of this.attempts) {
      if (entry.until <= now) this.attempts.delete(key);
    }
    const key = context.switchToHttp().getRequest<Request>().ip ?? 'unknown';
    const entry = this.attempts.get(key) ?? { count: 0, until: now + 60_000 };
    if (
      entry.count >= 10 ||
      (!this.attempts.has(key) && this.attempts.size >= 10_000)
    ) {
      throw new HttpException('Demasiados intentos. Reintentá más tarde.', 429);
    }
    entry.count++;
    this.attempts.set(key, entry);
    return true;
  }
}
