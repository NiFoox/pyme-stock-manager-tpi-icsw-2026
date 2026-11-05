import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

config({ path: new URL('../.env', import.meta.url), quiet: true });
function parseUrl(value) {
  try {
    return new URL(value ?? '');
  } catch {
    throw new Error('Configurar URL PostgreSQL válidas; no se muestra el valor por seguridad.');
  }
}
const test = parseUrl(process.env.TEST_DATABASE_URL);
const dev = process.env.DATABASE_URL ? parseUrl(process.env.DATABASE_URL) : undefined;
if (!['postgres:', 'postgresql:'].includes(test.protocol) || !test.username || !test.password ||
    !decodeURIComponent(test.pathname).endsWith('_test') ||
    (dev?.host === test.host && dev.pathname === test.pathname)) {
  throw new Error('TEST_DATABASE_URL debe ser una base _test separada de desarrollo.');
}
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url)), 'migrate', 'deploy'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, DATABASE_URL: test.href },
  stdio: 'inherit',
});
if (result.error) throw new Error('No se pudo ejecutar Prisma migrate deploy.');
process.exitCode = result.status ?? 1;
