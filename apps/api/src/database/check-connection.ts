import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseModule } from './database.module.js';
import { PrismaService } from './prisma.service.js';

let context: INestApplicationContext | undefined;
try {
  context = await NestFactory.createApplicationContext(DatabaseModule, {
    logger: false,
    abortOnError: false,
  });
  const prisma = context.get(PrismaService);
  await prisma.$connect();
  const result = await prisma.$queryRaw<
    { value: number }[]
  >`SELECT 1::int AS value`;
  if (result[0]?.value !== 1) throw new Error('Unexpected database response');
  console.log('PostgreSQL: conexion Prisma/NestJS verificada (SELECT 1).');
} catch {
  console.error(
    'No se pudo verificar PostgreSQL. Revisar configuracion y disponibilidad.',
  );
  process.exitCode = 1;
} finally {
  await context?.close();
}
