import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from '../src/configure-app.js';

describe('HTTP availability (without PostgreSQL)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
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
});
