import { randomBytes } from 'node:crypto';
import { authConfig } from './auth-config.js';

describe('session configuration', () => {
  const secret = randomBytes(32).toString('hex');
  it.each([undefined, '', 'password', 'a'.repeat(64)])(
    'rejects weak secrets',
    (value) => {
      expect(() => authConfig({ SESSION_SECRET: value })).toThrow(
        /^SESSION_SECRET/,
      );
    },
  );
  it('defaults to eight hours and enforces secure cookies in production', () => {
    expect(
      authConfig({ SESSION_SECRET: secret, NODE_ENV: 'production' }),
    ).toEqual({ secret, ttl: 28800, secure: true, proxyHops: 0 });
    expect(
      authConfig({
        SESSION_SECRET: secret,
        SESSION_TTL_SECONDS: '3600',
        TRUST_PROXY_HOPS: '1',
      }).ttl,
    ).toBe(3600);
  });
  it.each(['0', 'NaN', '60.5', '604801'])('rejects invalid expiry', (ttl) => {
    expect(() =>
      authConfig({ SESSION_SECRET: secret, SESSION_TTL_SECONDS: ttl }),
    ).toThrow(/^SESSION_TTL_SECONDS/);
  });
  it('rejects invalid proxy configuration', () => {
    expect(() =>
      authConfig({ SESSION_SECRET: secret, TRUST_PROXY_HOPS: '-1' }),
    ).toThrow(/^TRUST_PROXY_HOPS/);
  });
});
