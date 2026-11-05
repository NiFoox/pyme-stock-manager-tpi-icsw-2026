import { type INestApplication, ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import type { Express, Request, Response, NextFunction } from 'express';
import { SessionStore } from './identity/session-store.js';
import { authConfig, SESSION_COOKIE } from './identity/auth-config.js';
import { ApiErrorFilter } from './identity/api-error.filter.js';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  const config = authConfig();
  const express = app.getHttpAdapter().getInstance() as Express;
  express.set('trust proxy', config.proxyHops);
  app.enableCsrfProtection();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiErrorFilter());
  app.use('/api/auth', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const sessionMiddleware = session({
    name: SESSION_COOKIE,
    secret: config.secret,
    store: app.get(SessionStore).store,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secure,
      path: '/api',
      maxAge: config.ttl * 1000,
    },
  });
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Match Express's case-insensitive health route and optional trailing slash.
    // Do not even load a supplied session cookie for this public liveness endpoint.
    if (/^\/health\/?$/i.test(req.path)) return next();
    return sessionMiddleware(req, res, next);
  });
  app.enableShutdownHooks();
}
