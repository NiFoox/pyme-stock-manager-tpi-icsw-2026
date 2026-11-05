import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  Req,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { databaseUrl, loadEnvironment } from '../src/config/environment.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { provisionAdmin } from '../src/identity/provision-admin.js';
import { hashPassword } from '../src/identity/password.js';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../src/identity/session-auth.guard.js';
import { IdentityModule } from '../src/identity/identity.module.js';

// Deliberately registered only in the testing module, outside /auth.
@Controller('protected-test')
@UseGuards(SessionAuthGuard)
class ProtectedTestController {
  @Get()
  current(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}

describe('Authentication with real PostgreSQL sessions', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const username = `auth_${randomBytes(6).toString('hex')}`;
  const password = randomBytes(18).toString('hex');
  let id: bigint;
  let attempt = 0;
  const cookie = (response: Response): string => {
    const header = response.headers['set-cookie'] as unknown as string[];
    const result = header[0]!.split(';')[0]!;
    return result;
  };
  const login = (name = username, pass = password) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', `192.0.2.${++attempt}`)
      .set('Sec-Fetch-Site', 'same-origin')
      .send({ username: name, password: pass });

  beforeAll(async () => {
    loadEnvironment();
    const test = new URL(databaseUrl(process.env.TEST_DATABASE_URL));
    const dev = process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL)
      : undefined;
    if (
      !test.pathname.endsWith('_test') ||
      (dev?.host === test.host && dev.pathname === test.pathname)
    ) {
      throw new Error('Se requiere una base _test separada de desarrollo.');
    }
    vi.stubEnv('DATABASE_URL', test.href);
    vi.stubEnv('SESSION_SECRET', randomBytes(32).toString('hex'));
    vi.stubEnv('TRUST_PROXY_HOPS', '1');
    const module = await Test.createTestingModule({
      imports: [AppModule, IdentityModule],
      controllers: [ProtectedTestController],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
      },
    });
    id = user.id;
  });

  afterAll(async () => {
    if (prisma) {
      // Delete only fixtures created by this suite, including their sessions.
      await prisma.$executeRaw`DELETE FROM sessions WHERE sess->>'userId' = ${id?.toString() ?? ''}`;
      await prisma.user.deleteMany({
        where: { username: { startsWith: username } },
      });
    }
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('logs in, persists only user id, restores with a new client and sets cookie attributes', async () => {
    const result = await login(`  ${username.toUpperCase()}  `).expect(200);
    expect(result.body).toEqual({ id: id.toString(), username, role: 'ADMIN' });
    const header = (result.headers['set-cookie'] as unknown as string[])[0]!;
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/api');
    expect(header).not.toMatch(/Domain=|Secure/);
    const saved = await prisma.$queryRaw<
      { sess: { userId: string }; expire: Date }[]
    >`SELECT sess, expire FROM sessions WHERE sess->>'userId' = ${id.toString()}`;
    expect(saved).toHaveLength(1);
    expect(Object.keys(saved[0]!.sess).sort()).toEqual(['cookie', 'userId']);
    expect(saved[0]!.expire.getTime() - Date.now()).toBeGreaterThan(28_700_000);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie(result))
      .expect(200, result.body);
  });

  it('returns the same generic 401 for wrong password, nonexistent and inactive users', async () => {
    const wrong = await login(username, 'incorrect').expect(401);
    const missing = await login(`${username}_missing`).expect(401);
    await prisma.user.update({ where: { id }, data: { active: false } });
    try {
      const inactive = await login().expect(401);
      expect(inactive.body).toEqual(wrong.body);
      expect(missing.body).toEqual(wrong.body);
      expect(inactive.headers['set-cookie']).toBeUndefined();
    } finally {
      await prisma.user.update({ where: { id }, data: { active: true } });
    }
  });

  it('reuses sessions outside /auth, reloads the current role and denies inactive/deleted users', async () => {
    await request(app.getHttpServer()).get('/api/protected-test').expect(401);
    await request(app.getHttpServer())
      .get('/api/protected-test')
      .set('Cookie', 'pyme.sid=tampered')
      .expect(401);
    const token = cookie(await login().expect(200));
    await request(app.getHttpServer())
      .get('/api/protected-test')
      .set('Cookie', token)
      .expect(200, { id: id.toString(), username, role: 'ADMIN' });
    await prisma.user.update({ where: { id }, data: { role: 'OPERATOR' } });
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/protected-test')
          .set('Cookie', token)
          .expect(200)
      ).body.role,
    ).toBe('OPERATOR');
    await prisma.user.update({ where: { id }, data: { active: false } });
    await request(app.getHttpServer())
      .get('/api/protected-test')
      .set('Cookie', token)
      .expect(401);
    await prisma.user.update({
      where: { id },
      data: { active: true, role: 'ADMIN' },
    });
    const temporary = await prisma.user.create({
      data: {
        username: `${username}_deleted`,
        passwordHash: await hashPassword(password),
        role: 'OPERATOR',
      },
    });
    const deletedToken = cookie(await login(temporary.username).expect(200));
    await prisma.user.delete({ where: { id: temporary.id } });
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', deletedToken)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', deletedToken)
      .expect(204);
  });

  it('regenerates on login, destroys the old session and invalidates logout server-side', async () => {
    const old = cookie(await login().expect(200));
    const next = cookie(await login().set('Cookie', old).expect(200));
    expect(next).not.toBe(old);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', old)
      .expect(401);
    const result = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', next)
      .expect(204);
    expect((result.headers['set-cookie'] as unknown as string[])[0]).toMatch(
      /pyme.sid=;.*Expires=Thu, 01 Jan 1970/,
    );
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', next)
      .expect(401);
    await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
  });

  it('rejects expired sessions and requests without a valid session', async () => {
    const token = cookie(await login().expect(200));
    await prisma.$executeRaw`UPDATE sessions SET expire = now() - interval '1 second' WHERE sess->>'userId' = ${id.toString()}`;
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', token)
      .expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'pyme.sid=tampered')
      .expect(401);
  });

  it('uses Secure over HTTPS through an explicitly trusted proxy', async () => {
    const result = await login().set('X-Forwarded-Proto', 'https').expect(200);
    expect((result.headers['set-cookie'] as unknown as string[])[0]).toContain(
      '; Secure',
    );
    cookie(result);
  });

  it.each(['cross-site', 'same-site'])(
    'rejects %s mutations before changing the session',
    async (site) => {
      const token = cookie(await login().expect(200));
      for (const route of ['login', 'logout']) {
        await request(app.getHttpServer())
          .post(`/api/auth/${route}`)
          .set('Cookie', token)
          .set('Sec-Fetch-Site', site)
          .send({ username, password })
          .expect(403);
      }
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', token)
        .expect(200);
    },
  );

  it('rejects foreign or opaque Origin and accepts same Origin without Fetch Metadata', async () => {
    for (const origin of ['https://attacker.example', 'null']) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ username, password })
        .expect(403);
    }
    const result = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Host', 'localhost:3000')
      .set('Origin', 'http://localhost:3000')
      .set('X-Forwarded-For', '192.0.2.240')
      .send({ username, password })
      .expect(200);
    cookie(result);
  });

  it('validates DTOs and limits login attempts without creating sessions', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: {}, password: [] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password, role: 'ADMIN' })
      .expect(400);
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.0.2.250')
        .send({ username: `${username}_missing`, password })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', '192.0.2.250')
      .send({ username, password })
      .expect(429);
  });

  it('enforces canonical usernames and uniqueness in PostgreSQL and refuses bootstrap overwrites', async () => {
    const data = {
      username,
      passwordHash: await hashPassword(password),
      role: 'ADMIN' as const,
    };
    await expect(prisma.user.create({ data })).rejects.toThrow();
    await expect(
      prisma.user.create({
        data: { ...data, username: username.toUpperCase() },
      }),
    ).rejects.toThrow();
    await expect(provisionAdmin(prisma, username, password)).rejects.toThrow(
      /aprovisionamiento/,
    );
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id } })).passwordHash,
    ).toMatch(/^\$argon2id\$/);
  });
});
