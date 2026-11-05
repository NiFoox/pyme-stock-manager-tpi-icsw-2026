# US-01 — Verificación local y entrega

Fecha local: 4 de noviembre de 2026. Rama: feat/us-01-authentication, creada desde main (c38bdc2).
Cambios sin commit, push ni PR. No se modificó la bitácora del equipo.

## Revisión puntual posterior de los tres hallazgos

Se confirmó el montaje limitado del middleware y se amplió a `/api`, exceptuando
health antes de cargar la cookie. El nuevo [SessionAuthGuard](../apps/api/src/identity/session-auth.guard.ts)
se exporta desde IdentityModule y se aplica en `/auth/me`. Reutiliza la consulta del
usuario activo y rol vigente, y expone solo datos públicos en `request.user`.
Una ruta exclusivamente de pruebas comprueba su uso fuera de `/auth`; no se agregan
rutas ficticias a producción ni funciones de otras historias.

Se confirmó que el filtro confundía errores inesperados con indisponibilidad.
Ahora preserva errores HTTP conocidos, devuelve 503 para códigos identificados de
conectividad/pool/PostgreSQL (y mensajes exactos de conexión sin código de pg/pg-pool)
y 500 para errores inesperados. El log usa categorías, tipos y códigos permitidos;
no registra mensajes originales, SQL, credenciales ni stacks.
[OpenAPI](openapi.yaml) incorpora el contrato de 500.

Se mantiene el limitador: contar todos los intentos también acota trabajo Argon2id
con credenciales válidas. `req.ip` respeta la configuración existente de confianza
en proxies, desactivada por defecto. El cupo compartido por NAT, la confianza en el
proxy y el límite por proceso quedan documentados en la [guía](us-01-autenticacion.md).

Verificaciones ejecutadas para esta revisión:

| Comando | Resultado |
|---|---|
| `npm run test -w apps/api -- src/identity/api-error.filter.spec.ts` | 10 pruebas correctas |
| `npm run test:e2e -w apps/api -- test/app.e2e-spec.ts` | 4 pruebas correctas, SQL inaccesible y health con cookie |
| `npm run test:integration -w apps/api -- test/auth.integration-spec.ts` | 11 pruebas correctas contra PostgreSQL real |
| `npm run build:api` | Correcto |
| `npm run lint:api` | Correcto, sin advertencias |
| `npm run test:api:runtime` | Correcto, health desde ESM compilado sin PostgreSQL |
| Diagnósticos del editor para API | Sin errores |

No se repitieron las suites de Angular, provisión ni configuración, ya que no se
modificaron. No se actualizaron dependencias, esquema, migraciones ni la bitácora.
No se ejecutó CI remoto. Las capturas Git y resultados completos de abajo corresponden
a la entrega inicial; esta sección registra únicamente la revisión posterior.

## Implementación y decisiones

Identity implementa login, usuario vigente y logout; Argon2id; sesiones PostgreSQL;
CSRF nativo de NestJS 12.3.2; cookie HttpOnly/SameSite=Lax/Secure con HTTPS;
regeneración de sesión, expiración absoluta configurable (8 horas), validación DTO y
límite local de 10 intentos por IP/minuto. Angular incluye formulario, recuperación
por /auth/me, protección de navegación y salida. No se adelanta US-02.

Usuario canónico ASCII en minúsculas con CHECK y UNIQUE en PostgreSQL. Id BIGINT
expuesto como string. El primer ADMIN se crea por CLI con contraseña en stdin,
sin credenciales predeterminadas y con bloqueo transaccional contra altas concurrentes.
Las sesiones tienen representación @@ignore en Prisma para conservar su estructura
en futuras migraciones y son gestionadas por connect-pg-simple.

Ver [configuración, procedimiento de administrador y limitaciones de CSRF](us-01-autenticacion.md)
y [OpenAPI](openapi.yaml).

## Resultados reales

| Validación | Resultado |
|---|---|
| npm run build | API y Angular correctos |
| npm run lint | Ambas aplicaciones correctas; lint API repetido tras corregir advertencia de tipado de close() |
| npm run test:api | 21 pruebas, 2 archivos, correctas |
| npm run test:api:e2e | 4 pruebas HTTP sin SQL, correctas |
| npm run test:api:integration | 13 pruebas, 3 archivos, PostgreSQL 18 real, correctas |
| npm run test:web | 5 pruebas, 2 archivos, correctas al reintentar |
| npm run test:api:runtime | Health desde ESM compilado sin SQL, correcto |
| Diagnóstico SQL compilado contra TEST_DATABASE_URL | SELECT 1 mediante Prisma/NestJS, correcto |
| npm run prisma:validate | Esquema válido |
| npm run prisma:migrate:test | Migración aplicada y segunda ejecución sin migraciones pendientes |
| Prisma migrate diff entre BD de pruebas y schema | Migración vacía, exit code 0 |
| Reproducción SQL desde cero y primer ADMIN concurrente | Correctas en esquema temporal propio de la suite |
| OpenAPI | Parseado y formateado con Prettier |
| Diagnósticos del editor | Sin errores |
| Versiones de paquetes preexistentes en lockfile | Ninguna modificada |

La integración comprueba login válido/inválido, usuario inexistente/inactivo/eliminado,
consulta de rol vigente, persistencia real, expiración, cookie segura, regeneración,
logout efectivo, solicitudes CSRF cross-site/same-site/Origin, validaciones, throttle,
unicidad SQL y rechazo de sobrescrituras. La suite de provisión reproduce el SQL en un
esquema temporal nuevo y comprueba que solo una de dos altas concurrentes tiene éxito.
Los fixtures se eliminan al finalizar; no se borraron bases ni volúmenes existentes.

## Limitaciones y pendientes operativos

- Un primer intento de test:web falló por timeout al iniciar el worker de Vitest, sin
  ejecutar pruebas; la repetición completó las cinco sin errores.
- No se ejecutó CI remoto ni Playwright en navegador completo. Angular se verificó con
  pruebas de componentes, HTTP y navegación; backend con Supertest y PostgreSQL real.
- No se configuraron secretos locales ni se crearon cuentas en desarrollo. Para usar
  la aplicación: configurar SESSION_SECRET, aplicar migraciones a desarrollo y
  aprovisionar el primer administrador siguiendo la guía.
- El límite de intentos es por proceso; revisar antes de usar varias instancias.
  HTTPS, HSTS y cantidad de proxies confiables dependen del despliegue final.
- npm informó dos vulnerabilidades moderadas durante instalación; no se ejecutó
  audit fix ni se cambiaron versiones ajenas a US-01, incluyendo minimatch.
- El diff --stat de abajo corresponde a archivos ya rastreados; los nuevos archivos
  aparecen en status y en el inventario completo, sin agregarlos al índice.

## Inventario completo de archivos cambiados

- [.github/workflows/ci.yml](../.github/workflows/ci.yml)
- [README.md](../README.md)
- [apps/api/.env.example](../apps/api/.env.example)
- [apps/api/package.json](../apps/api/package.json)
- [apps/api/prisma/migrations/20261104000000_identity/migration.sql](../apps/api/prisma/migrations/20261104000000_identity/migration.sql)
- [apps/api/prisma/migrations/migration_lock.toml](../apps/api/prisma/migrations/migration_lock.toml)
- [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma)
- [apps/api/scripts/migrate-test.mjs](../apps/api/scripts/migrate-test.mjs)
- [apps/api/scripts/smoke-runtime.mjs](../apps/api/scripts/smoke-runtime.mjs)
- [apps/api/src/app.module.ts](../apps/api/src/app.module.ts)
- [apps/api/src/configure-app.ts](../apps/api/src/configure-app.ts)
- [apps/api/src/identity/api-error.filter.ts](../apps/api/src/identity/api-error.filter.ts)
- [apps/api/src/identity/auth-config.spec.ts](../apps/api/src/identity/auth-config.spec.ts)
- [apps/api/src/identity/auth-config.ts](../apps/api/src/identity/auth-config.ts)
- [apps/api/src/identity/auth.controller.ts](../apps/api/src/identity/auth.controller.ts)
- [apps/api/src/identity/auth.service.ts](../apps/api/src/identity/auth.service.ts)
- [apps/api/src/identity/create-admin.ts](../apps/api/src/identity/create-admin.ts)
- [apps/api/src/identity/identity.module.ts](../apps/api/src/identity/identity.module.ts)
- [apps/api/src/identity/login-throttle.guard.ts](../apps/api/src/identity/login-throttle.guard.ts)
- [apps/api/src/identity/login.dto.ts](../apps/api/src/identity/login.dto.ts)
- [apps/api/src/identity/password.ts](../apps/api/src/identity/password.ts)
- [apps/api/src/identity/provision-admin.ts](../apps/api/src/identity/provision-admin.ts)
- [apps/api/src/identity/session-store.ts](../apps/api/src/identity/session-store.ts)
- [apps/api/test/app.e2e-spec.ts](../apps/api/test/app.e2e-spec.ts)
- [apps/api/test/auth.integration-spec.ts](../apps/api/test/auth.integration-spec.ts)
- [apps/api/test/provision.integration-spec.ts](../apps/api/test/provision.integration-spec.ts)
- [apps/web/src/app/app.config.ts](../apps/web/src/app/app.config.ts)
- [apps/web/src/app/app.html](../apps/web/src/app/app.html)
- [apps/web/src/app/app.routes.ts](../apps/web/src/app/app.routes.ts)
- [apps/web/src/app/app.scss](../apps/web/src/app/app.scss)
- [apps/web/src/app/app.spec.ts](../apps/web/src/app/app.spec.ts)
- [apps/web/src/app/app.ts](../apps/web/src/app/app.ts)
- [apps/web/src/app/identity/auth.guard.ts](../apps/web/src/app/identity/auth.guard.ts)
- [apps/web/src/app/identity/auth.service.ts](../apps/web/src/app/identity/auth.service.ts)
- [apps/web/src/app/identity/auth.spec.ts](../apps/web/src/app/identity/auth.spec.ts)
- [apps/web/src/app/identity/login.ts](../apps/web/src/app/identity/login.ts)
- [apps/web/src/app/identity/session.ts](../apps/web/src/app/identity/session.ts)
- [docs/arquitectura.md](../docs/arquitectura.md)
- [docs/openapi.yaml](../docs/openapi.yaml)
- [docs/setup.md](../docs/setup.md)
- [docs/us-01-autenticacion.md](../docs/us-01-autenticacion.md)
- [docs/us-01-verificacion.md](../docs/us-01-verificacion.md)
- [package-lock.json](../package-lock.json)
- [package.json](../package.json)

## Estado Git

### git status -sb

```text
## feat/us-01-authentication
 M .github/workflows/ci.yml
 M README.md
 M apps/api/.env.example
 M apps/api/package.json
 M apps/api/prisma/schema.prisma
 M apps/api/scripts/smoke-runtime.mjs
 M apps/api/src/app.module.ts
 M apps/api/src/configure-app.ts
 M apps/api/test/app.e2e-spec.ts
 M apps/web/src/app/app.config.ts
 M apps/web/src/app/app.html
 M apps/web/src/app/app.routes.ts
 M apps/web/src/app/app.scss
 M apps/web/src/app/app.spec.ts
 M apps/web/src/app/app.ts
 M docs/arquitectura.md
 M docs/openapi.yaml
 M docs/setup.md
 M package-lock.json
 M package.json
?? apps/api/prisma/migrations/
?? apps/api/scripts/migrate-test.mjs
?? apps/api/src/identity/
?? apps/api/test/auth.integration-spec.ts
?? apps/api/test/provision.integration-spec.ts
?? apps/web/src/app/identity/
?? docs/us-01-autenticacion.md
?? docs/us-01-verificacion.md
```

Exit code: 0.

### git diff --check

```text
(sin salida estándar)
```

Exit code: 0.

Avisos de Git:

```text
warning: in the working copy of 'apps/web/src/app/app.spec.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/openapi.yaml', LF will be replaced by CRLF the next time Git touches it
```

### git diff --stat

```text
 .github/workflows/ci.yml           |   2 +
 README.md                          |  11 +-
 apps/api/.env.example              |   5 +
 apps/api/package.json              |   9 +
 apps/api/prisma/schema.prisma      |  29 ++++
 apps/api/scripts/smoke-runtime.mjs |   2 +
 apps/api/src/app.module.ts         |   3 +-
 apps/api/src/configure-app.ts      |  41 ++++-
 apps/api/test/app.e2e-spec.ts      |  31 ++++
 apps/web/src/app/app.config.ts     |   2 +
 apps/web/src/app/app.html          | 345 +------------------------------------
 apps/web/src/app/app.routes.ts     |   9 +-
 apps/web/src/app/app.scss          |   1 +
 apps/web/src/app/app.spec.ts       |  28 +--
 apps/web/src/app/app.ts            |   6 +-
 docs/arquitectura.md               |   5 +-
 docs/openapi.yaml                  | 151 ++++++++++++++++
 docs/setup.md                      |  23 +--
 package-lock.json                  | 247 +++++++++++++++++++++++++-
 package.json                       |   2 +
 20 files changed, 560 insertions(+), 392 deletions(-)
```

Exit code: 0.

Avisos de Git:

```text
warning: in the working copy of 'apps/web/src/app/app.spec.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/openapi.yaml', LF will be replaced by CRLF the next time Git touches it
```
