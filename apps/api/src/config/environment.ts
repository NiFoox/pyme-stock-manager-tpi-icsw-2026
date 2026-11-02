import { config } from 'dotenv';

export function loadEnvironment(): void {
  // Both src/config and dist/config resolve to apps/api/.env.
  config({ path: new URL('../../.env', import.meta.url), quiet: true });
}

export function databaseUrl(value: string | undefined): string {
  try {
    const url = new URL(value ?? '');
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      !url.password ||
      url.pathname.length < 2
    ) {
      throw new Error();
    }
    return url.href;
  } catch {
    throw new Error(
      'DATABASE_URL debe ser una URL PostgreSQL con usuario, password y base.',
    );
  }
}

export function readEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535.');
  }
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV debe ser development, test o production.');
  }
  return { databaseUrl: databaseUrl(env.DATABASE_URL), port, nodeEnv };
}
