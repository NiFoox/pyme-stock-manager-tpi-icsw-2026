# API — Inventario PyME

NestJS 12, Express, TypeScript NodeNext/ESM, Prisma 7.10.1 y PostgreSQL 18.
El bootstrap fue integrado mediante el [PR #3](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/pull/3).

Instalar desde la raíz con npm ci. No crear un lockfile local.
Seguir la [guía de entorno, pruebas y migraciones](../../docs/setup.md).

Desde la raíz:

~~~
npm run dev:api
npm run build:api
npm run lint:api
npm run test:api
npm run test:api:e2e
npm run test:api:integration
npm run test:api:runtime
npm run db:check
~~~

Los comandos de runtime y diagnóstico requieren build previo. Integración exige
TEST_DATABASE_URL y PostgreSQL separado del desarrollo. GET /api/health solo
comprueba HTTP; no consulta la base. Ver [OpenAPI](../../docs/openapi.yaml).

INFRA-01 no incluye modelos, seeds ni migraciones de negocio. El cliente se genera
antes del build y no se versiona. La API usa conexión diferida, cierra Prisma al
terminar y nunca ejecuta migraciones durante el arranque.
