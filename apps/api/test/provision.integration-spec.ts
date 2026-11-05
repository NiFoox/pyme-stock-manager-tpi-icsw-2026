import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { databaseUrl, loadEnvironment } from '../src/config/environment.js';
import { provisionAdmin } from '../src/identity/provision-admin.js';
import { verify } from 'argon2';

it('replays the migration in an isolated schema and provisions exactly one initial admin under concurrency', async () => {
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
  const schema = `auth_fixture_${randomBytes(8).toString('hex')}`;
  const pool = new pg.Pool({
    connectionString: test.href,
    options: `-c search_path=${schema}`,
    connectionTimeoutMillis: 5000,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
  const password = randomBytes(20).toString('hex');
  let created = false;
  try {
    // The identifier is generated above from a fixed prefix plus hex, never user input.
    await pool.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    const sql = await readFile(
      new URL(
        '../prisma/migrations/20261104000000_identity/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await pool.query(sql);
    const results = await Promise.allSettled([
      provisionAdmin(prisma, '  First.Admin  ', password),
      provisionAdmin(prisma, 'second.admin', password),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0]!.role).toBe('ADMIN');
    expect(users[0]!.active).toBe(true);
    expect(users[0]!.username).toMatch(/^(first|second)\.admin$/);
    expect(await verify(users[0]!.passwordHash, password)).toBe(true);
    await expect(
      provisionAdmin(prisma, users[0]!.username, 'another-password'),
    ).rejects.toThrow(/aprovisionamiento/);
    expect((await prisma.user.findMany())[0]!.passwordHash).toBe(
      users[0]!.passwordHash,
    );
    const tables = await pool.query<{ name: string }>(
      'SELECT tablename AS name FROM pg_tables WHERE schemaname = $1',
      [schema],
    );
    expect(tables.rows.map((row) => row.name).sort()).toEqual([
      'sessions',
      'users',
    ]);
  } finally {
    await prisma.$disconnect();
    // Only this suite's generated fixture schema, never existing databases or tables.
    if (created) await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  }
}, 15_000);
