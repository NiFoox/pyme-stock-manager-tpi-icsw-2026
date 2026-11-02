import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: new URL('./.env', import.meta.url), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation needs no running database. Database commands require this URL.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
