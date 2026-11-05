# Entorno de desarrollo — Inventario PyME

El bootstrap Angular/NestJS fue integrado en main mediante el
[PR #3](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/pull/3).
No volver a generar las aplicaciones. INFRA-01 corresponde al
[Issue #2](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/issues/2).
El equipo tiene cuatro integrantes, identificados en el [README](../README.md#equipo).

## Requisitos

- Node.js 26.13.0 y npm 11.20.0 (baseline del equipo).
- Git, Docker Desktop con motor Linux iniciado y Docker Compose v2.
- Puertos locales 3000 (API), 4200 (web), 5432 (BD desarrollo) y 5433 (BD pruebas).

NestJS 12 ESM/NodeNext y Angular 22 conservan su tooling: Vitest/Supertest/oxlint
en API y Vitest/Angular ESLint en web. CLI, cliente y adaptador Prisma usan 7.10.1.
No instalar prisma@latest.

## Preparar un checkout limpio

Todos los comandos npm se ejecutan desde la raíz. En PowerShell usar npm.cmd si
la política local bloquea npm.ps1; no es necesario cambiar esa política.

1. Copiar [.env.example](../.env.example) a .env y
   [apps/api/.env.example](../apps/api/.env.example) a apps/api/.env.
   PowerShell: Copy-Item .env.example .env y Copy-Item apps/api/.env.example apps/api/.env.
   Copiar únicamente si los archivos de destino no existen.
2. Reemplazar los marcadores de contraseña por valores locales independientes.
   Completar las URL de la API con esas credenciales y los puertos elegidos.
3. Instalar y preparar el cliente:

~~~
npm ci
npm run prisma:validate
npm run prisma:generate
npm run db:up
npm run build:api
npm run db:check
~~~

npm ci utiliza únicamente [package-lock.json](../package-lock.json). Build y
arranque de desarrollo generan el cliente antes de usarlo; no requieren artefactos
de otro checkout. Generar no necesita PostgreSQL disponible; los comandos de BD
sí necesitan URL válida y conectividad.

La configuración está en [prisma.config.ts](../apps/api/prisma.config.ts) y el
esquema en [schema.prisma](../apps/api/prisma/schema.prisma). US-01 agrega usuarios y
sesiones: seguir la [guía de autenticación](us-01-autenticacion.md) para configurar
SESSION_SECRET, aplicar migraciones y crear el primer administrador antes de usar HTTP.
No usar flags de generación tomados de otras versiones sin comprobarlos.

## Variables y red

| Consumidor | Configuración | Dirección PostgreSQL |
|---|---|---|
| Compose | .env raíz: POSTGRES_* | Puerto interno 5432 |
| API y Prisma CLI en el host | apps/api/.env: DATABASE_URL | 127.0.0.1:5432 por defecto |
| Integración local | TEST_DATABASE_URL | 127.0.0.1:5433/inventario_test |
| CI sobre runner Ubuntu | Variables del workflow | 127.0.0.1:5432/inventario_test |
| Futura API en contenedor | Variables del proceso | db:5432 (fuera de este hito) |

Compose carga el archivo raíz para interpolar variables. API y CLI cargan
explícitamente el archivo de la API. Las variables del proceso tienen prioridad.
Las rutas no dependen del directorio de invocación. No hay expansión entre
archivos: escribir URL completas y codificar caracteres especiales de
usuario/password. Nunca incluir URL de BD en Angular.

DATABASE_URL exige protocolo postgresql/postgres, usuario, contraseña y base.
PORT es un entero entre 1 y 65535; NODE_ENV admite development, test y production.
Los errores de configuración no imprimen valores secretos.

Los archivos .env reales y el cliente generado no se versionan. Las credenciales
de Compose son para desarrollo/pruebas. El despliegue deberá definir permisos
mínimos de aplicación y migración, y TLS según su topología.

## PostgreSQL

[Compose](../compose.yml) fija PostgreSQL 18.6-bookworm. El volumen nombrado se
monta en /var/lib/postgresql, conforme al layout de la imagen PostgreSQL 18.
El servicio db-test, bajo perfil test, usa otro puerto y almacenamiento temporal.
Los puertos se publican solo en loopback.

~~~
npm run db:up
npm run db:test:up
docker compose ps
npm run db:down
~~~

db:down detiene el entorno sin borrar volúmenes. No usar down -v como rutina.
db-test pierde datos al eliminar/recrear su contenedor. Nunca probar contra datos
de trabajo. pg_isready comprueba disponibilidad del servidor; db:check verifica
credenciales y consultas a través de Prisma/NestJS.

Cambiar POSTGRES_PASSWORD en .env no cambia la contraseña de un clúster ya
inicializado: requiere administración explícita y sincronizar las URL.
No borrar el volumen para resolver esa discrepancia.

Para verificar persistencia sin tablas artificiales, comparar el identificador
del clúster antes y después de detener/eliminar solamente el contenedor db y
levantarlo nuevamente conservando el volumen. La consulta es:
SELECT system_identifier FROM pg_control_system().
Esta comprobación administrativa es específica del entorno local.

## Desarrollo y contrato HTTP

En terminales separadas:

~~~
npm run dev:api
npm run dev:web
~~~

- API: http://localhost:3000/api/health, respuesta 200 con {"status":"ok"}.
- Web: http://localhost:4200, proxy /api/** hacia puerto 3000.
  Si cambia PORT, ajustar el proxy local de Angular.
- Para ejecutar el build: npm run start:prod -w apps/api.

Health indica que HTTP está vivo. La API puede responder con PostgreSQL detenido
si su configuración es válida: la conexión es diferida. db:check, después del
build, crea un contexto NestJS, ejecuta SELECT 1 y lo cierra. Un fallo produce
exit code 1 sin revelar la cadena de conexión. No hay readiness HTTP.
Ver [OpenAPI](openapi.yaml).

## Pruebas y CI

~~~
npm run build
npm run lint
npm run test:api
npm run test:api:e2e
npm run test:web
npm run db:test:up
npm run prisma:migrate:test
npm run test:api:integration
npm run test:api:runtime
~~~

- Unitarias API: validación de configuración, sin BD.
- HTTP/Supertest: health y prefijo, con una URL de BD inalcanzable.
- Integración: exige TEST_DATABASE_URL independiente y nombre terminado en _test;
  verifica SQL mediante el servicio inyectado y PostgreSQL major 18.
  Si falta configuración o BD, falla; no se omite silenciosamente.
- Runtime: requiere build, inicia dist/main.js con puerto libre y BD inalcanzable,
  consulta health y termina el proceso. Comprueba ESM compilado.
- db:check permite verificar consultas mediante el cliente compilado.

[CI](../.github/workflows/ci.yml) se ejecuta en PR hacia main y admite ejecución
manual. Usa npm ci, build/lint/tests de ambas
apps, PostgreSQL aislado, diagnóstico compilado y smoke HTTP compilado. Credenciales
desechables, sin secretos del equipo. Valida Compose; el service de Actions no
comprueba persistencia del volumen local.

CI/verify pasó en GitHub el 2 de noviembre de 2026 para el
[PR #4](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/pull/4), en la
[ejecución 41529783324](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/actions/runs/41529783324).
Ver [evidencia INFRA-01](infra-01-verificacion.md#ci-remoto-verificado).
El PR sigue pendiente de revisión y las advertencias moderadas de minimatch
continúan como riesgo pendiente de seguimiento; el éxito de CI no las resuelve.

## Migraciones versionadas

~~~
npm run prisma:migrate:status
npm run prisma:migrate:dev -- --name nombre_del_cambio
npm run prisma:migrate:deploy
~~~

El primer modelo se incorpora en US-01. migrate dev crea cambios en
desarrollo y necesita permisos para una shadow database, o una shadow URL dedicada
al configurar otro entorno. Revisar y versionar el SQL real. migrate deploy aplica
migraciones existentes en pruebas/despliegue. Ambos usan DATABASE_URL: seleccionar
explícitamente la base destino.

INFRA-01 preparó la infraestructura; US-01 incorpora la migración de usuarios y sesiones.
`npm run prisma:migrate:test` aplica deploy exclusivamente a TEST_DATABASE_URL validada.
No hay seeds de cuentas predeterminadas ni db push.
La API nunca migra automáticamente al arrancar.

## Alcance posterior

Se mantienen las reglas de negocio acordadas. US-01 incorpora identidad y sesiones/CSRF.
Catálogo, inventario, reposición, reportes, Playwright, Dockerfiles de aplicaciones y
readiness corresponden a hitos posteriores. Las invariantes siguen en el
[análisis arquitectónico](analisis_decisiones_arquitectonicas_v4.md) y el
[registro técnico](registro_decisiones_menores_v4.md), sin cambios de negocio.
No se incorporan Redis, JWT, colas ni servicios externos.
La bitácora oficial sigue a cargo del equipo; esta guía no atribuye
deliberaciones ni fechas de adopción.
