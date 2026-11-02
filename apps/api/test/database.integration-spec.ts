import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { loadEnvironment, databaseUrl } from '../src/config/environment.js';
import { DatabaseModule } from '../src/database/database.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Prisma/NestJS with isolated PostgreSQL 18', () => {
  let context: TestingModule | undefined;
  let prisma: PrismaService;

  beforeAll(async () => {
    loadEnvironment();
    const testUrl = new URL(databaseUrl(process.env.TEST_DATABASE_URL));
    const developmentUrl = process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL)
      : undefined;
    if (
      !decodeURIComponent(testUrl.pathname).endsWith('_test') ||
      (developmentUrl?.host === testUrl.host &&
        developmentUrl.pathname === testUrl.pathname)
    ) {
      throw new Error(
        'TEST_DATABASE_URL debe apuntar a una base _test independiente de desarrollo.',
      );
    }
    vi.stubEnv('DATABASE_URL', testUrl.href);
    context = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();
    prisma = context.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await context?.close();
    vi.unstubAllEnvs();
  });

  it('executes SQL through the injected client against the test database', async () => {
    const result = await prisma.$queryRaw<
      { value: number; database: string; version: number }[]
    >`SELECT 1::int AS value, current_database() AS database,
      current_setting('server_version_num')::int AS version`;
    expect(result[0]?.value).toBe(1);
    expect(result[0]?.database).toBe(
      decodeURIComponent(
        new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1),
      ),
    );
    expect(result[0]?.version).toBeGreaterThanOrEqual(180000);
    expect(result[0]?.version).toBeLessThan(190000);
  });
});
