import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { createHmac, randomBytes } from 'node:crypto';

describe('HTTP availability (without PostgreSQL)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    vi.stubEnv('SESSION_SECRET', randomBytes(32).toString('hex'));
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://unused:unused@127.0.0.1:1/unavailable',
    );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('GET /api/health returns only HTTP availability', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('does not expose the health route outside /api', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
    await request(app.getHttpServer()).get('/').expect(404);
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('denies authentication when PostgreSQL is unavailable without leaking details', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'unknown', password: 'incorrect' })
      .expect(503);
    expect(response.body).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Servicio temporalmente no disponible.',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('fails closed when the session store is unavailable while health stays public', async () => {
    const sid = randomBytes(24).toString('hex');
    const signature = createHmac('sha256', process.env.SESSION_SECRET!)
      .update(sid)
      .digest('base64')
      .replace(/=+$/, '');
    const cookie = `pyme.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(503);
    await request(app.getHttpServer())
      .get('/api/health')
      .set('Cookie', cookie)
      .expect(200, { status: 'ok' });
    await request(app.getHttpServer())
      .get('/api/HEALTH/')
      .set('Cookie', cookie)
      .expect(200, { status: 'ok' });
  });
});
