import 'reflect-metadata';
import { PrismaService } from '../database/prisma.service.js';
import { provisionAdmin } from './provision-admin.js';

// Redirect a private file or pipe from a secret manager; never argv or terminal echo.
const prisma = new PrismaService();
try {
  if (process.stdin.isTTY || process.argv.length !== 3) throw new Error();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > 1024) throw new Error();
    chunks.push(buffer);
  }
  const password = Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
  await provisionAdmin(prisma, process.argv[2]!, password);
  console.log('Primer administrador creado.');
} catch {
  console.error(
    'No se creó el administrador. Revisar entrada, migraciones y que no existan usuarios.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
