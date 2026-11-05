import { normalizeUsername } from './login.dto.js';
import { hashPassword } from './password.js';
import type { PrismaClient } from '../generated/prisma/client.js';

export async function provisionAdmin(
  prisma: PrismaClient,
  username: string,
  password: string,
) {
  const canonical = normalizeUsername(username);
  if (
    !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(canonical) ||
    password.length < 12 ||
    password.length > 128
  ) {
    throw new Error(
      'Usuario de 3 a 64 caracteres ASCII y contraseña de 12 a 128 caracteres requeridos.',
    );
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    // Serialize the race between the first two administrators.
    await tx.$executeRaw`LOCK TABLE users IN EXCLUSIVE MODE`;
    if ((await tx.user.count()) !== 0)
      throw new Error('El aprovisionamiento inicial ya no está permitido.');
    await tx.user.create({
      data: { username: canonical, passwordHash, role: 'ADMIN' },
    });
  });
}
