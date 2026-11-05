export const SESSION_COOKIE = 'pyme.sid';

export function authConfig(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.SESSION_SECRET ?? '';
  // Require generated entropy, not a short human password or example value.
  if (!/^[a-fA-F0-9]{64,}$/.test(secret) || new Set(secret).size < 8) {
    throw new Error(
      'SESSION_SECRET debe ser hexadecimal aleatorio de al menos 32 bytes.',
    );
  }
  const ttl = Number(env.SESSION_TTL_SECONDS ?? 28_800);
  if (!Number.isSafeInteger(ttl) || ttl < 60 || ttl > 604_800) {
    throw new Error('SESSION_TTL_SECONDS debe estar entre 60 y 604800.');
  }
  if (
    env.TRUST_PROXY_HOPS !== undefined &&
    !/^[0-9]+$/.test(env.TRUST_PROXY_HOPS)
  ) {
    throw new Error('TRUST_PROXY_HOPS debe ser un entero no negativo.');
  }
  if (
    !Number.isSafeInteger(Number(env.TRUST_PROXY_HOPS ?? 0)) ||
    Number(env.TRUST_PROXY_HOPS ?? 0) > 10
  ) {
    throw new Error('TRUST_PROXY_HOPS debe estar entre 0 y 10.');
  }
  return {
    secret,
    ttl,
    secure: env.NODE_ENV === 'production' ? true : ('auto' as const),
    proxyHops: Number(env.TRUST_PROXY_HOPS ?? 0),
  };
}
