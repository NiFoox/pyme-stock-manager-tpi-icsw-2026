import { databaseUrl, readEnvironment } from './environment.js';

const url = 'postgresql://user:password@127.0.0.1:5432/inventario';

describe('environment', () => {
  it('validates configuration and supplies the HTTP defaults', () => {
    expect(readEnvironment({ DATABASE_URL: url })).toEqual({
      databaseUrl: url,
      port: 3000,
      nodeEnv: 'development',
    });
  });

  it.each([undefined, '', 'https://example.com', 'postgresql://localhost/db'])(
    'rejects an invalid database URL without exposing credentials: %s',
    (value) => {
      expect(() => databaseUrl(value)).toThrow(/^DATABASE_URL debe ser/);
    },
  );

  it.each(['0', '65536', 'abc', '3000.5', ''])(
    'rejects invalid ports: %s',
    (port) => {
      expect(() => readEnvironment({ DATABASE_URL: url, PORT: port })).toThrow(
        /^PORT/,
      );
    },
  );

  it('rejects unknown environments', () => {
    expect(() =>
      readEnvironment({ DATABASE_URL: url, NODE_ENV: 'unknown' }),
    ).toThrow(/^NODE_ENV/);
  });
});
