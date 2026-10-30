# Guía de arranque técnico — Inventario PyME (propuesta v1)

**Actualizada:** 30/10/2026
**Estado:** bootstrap generado y verificado localmente según las salidas de consola compartidas por el equipo. La infraestructura PostgreSQL/Prisma/CI sigue pendiente (Issue #2).

## 1. Baseline

- Repositorio: `NiFoox/pyme-stock-manager-tpi-icsw-2026`; trabajo de bootstrap en la rama local `chore/project-bootstrap`, todavía pendiente de commit/PR.
- Node.js **26 LTS** (26.13.0 como versión objetivo inicial); npm workspaces, **un** `package-lock.json` en la raíz, versionado.
- `/apps/web`: Angular 22 / TypeScript, componentes standalone, organización por feature y clientes HTTP con URL relativa `/api`.
- `/apps/api`: NestJS 12.1+ con Express; módulos `identity`, `catalog`, `inventory`, `replenishment`, `reporting`.
- Prisma 7.10.1 **estable** (seleccionar explícitamente `prisma@7.10.1`, `@prisma/client@7.10.1` y adaptador de PostgreSQL compatible); **no** `prisma@latest` mientras la etiqueta apunte a Prisma 8 RC.
- PostgreSQL **18** elegido para el primer entorno Docker Compose (pendiente de instalación en INFRA-01); usar migraciones SQL cuando haga falta para `CHECK`/índices por expresión.
- `express-session` + `connect-pg-simple` con sesiones persistidas en PostgreSQL; Argon2id; CSRF nativo Nest 12.1+; HTTPS/Cookie Secure en producción.
- Compose conceptual: `db`, `api`, `web`. Redis deliberadamente ausente.
- No realizar migración de paquetes al azar: confirmar compatibilidad de versiones y ejecutar pruebas después de inicializar.

- **Scaffold backend:** proyecto NestJS 12 estándar **ESM**, con **Vitest** y **oxlint** generados; Supertest para API/integración. No habilitar NestJS monorepo mode.
- No usar Jest como runner de la API en el bootstrap: sustituye recomendación v2. Angular 22 también admite Vitest (seleccionado explícitamente en el comando), pero conserva su propia configuración independiente de Nest.
- Evitar `/packages`, Nx y Turborepo mientras no existan necesidades de compartir múltiples librerías u orquestar builds.

## 2. Layout propuesto

```text
pyme-stock-manager-tpi-icsw-2026/
├── apps/
│   ├── api/                           # NestJS (proyecto estándar)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── modules/                # se crean por necesidad
│   │   │   │   ├── identity/
│   │   │   │   ├── catalog/
│   │   │   │   ├── inventory/
│   │   │   │   ├── replenishment/
│   │   │   │   └── reporting/
│   │   │   ├── database/
│   │   │   ├── common/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/
│   │   └── package.json
│   └── web/                           # Angular (proyecto estándar)
│       ├── src/app/
│       │   ├── core/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── catalog/
│       │   │   ├── inventory/
│       │   │   ├── replenishment/
│       │   │   └── reports/
│       │   └── shared/
│       ├── angular.json
│       └── package.json
├── docs/
│   ├── analisis_decisiones_arquitectonicas_v4.md
│   ├── registro_decisiones_menores_v4.md
│   ├── arquitectura.md
│   └── setup.md
├── .github/workflows/
├── compose.yml
├── .env.example
├── package.json                    # { private: true, workspaces: ["apps/*"] }
├── package-lock.json               # lockfile único, generado por npm install raíz
└── README.md
```

No crear carpetas vacías solo para cumplir un organigrama: aparecen cuando haya código real.

## 3. Orden de implementación

1. Crear rama `chore/project-bootstrap`; no trabajar directamente en main.
2. Establecer Node 26 LTS; generar NestJS estándar ESM y Angular (ambos con `--skip-install`/`--skip-git`); configurar npm workspaces raíz e instalar **desde raíz** con un solo lockfile.
3. Primer health endpoint `GET /api/health` sin autenticación: verificar HTTP, build, lint y arranque.
4. Configuración `DATABASE_URL` desde `.env.example`; PostgreSQL con healthcheck y volumen persistente.
5. Prisma 7 stable + `@prisma/adapter-pg`: conexión y primera migración pequeña (no crear siete tablas sin tests de integración).
6. Tests de smoke/build/lint en GitHub Actions: API con Vitest/oxlint, web con scripts efectivamente generados/configurados.
7. Primera vertical funcional: sesión login → crear producto → ubicación → registrar saldo inicial/entrada → consultar stock/movimientos, con pruebas de transacción.
8. Después PR y rotación. Transferencia P1, Redis, BullMQ, JWT evolutivo quedan fuera de v1.

## 3.1. Referencia de bootstrap desde CMD en Windows (ya realizado; no repetir la generación)

El equipo seleccionó **Node.js 26 LTS**, comenzando con **26.13.0**. Como ya se creó la rama `chore/project-bootstrap`, **no repetir** `git switch -c`; confirmar la rama actual. Si Node 26 todavía no está instalado, abrir **CMD como administrador** y usar `nvm install 26.13.0` y `nvm use 26.13.0`. Conservar la instalación 24 LTS por si se necesitara volver temporalmente.

```cmd
REM Desde la raiz del repositorio, con CMD:
git status -sb
node -v
npm -v
npx -v
docker compose version

REM Solo si no existe la carpeta apps:
mkdir apps
cd apps

REM Generar proyectos independientes con los CLIs oficiales.
REM NestJS 12: elegir ESM cuando el CLI lo pregunte.
npx --yes @nestjs/cli@12 new api --skip-install --skip-git --package-manager npm --no-observe
npx --yes @angular/cli@22 new web --skip-install --skip-git --routing --style=scss --ssr=false --test-runner=vitest --defaults

cd ..
```

Si preferís **PowerShell**, el bloqueo local de scripts `.ps1` se evita ejecutando `npm.cmd` y `npx.cmd` en vez de `npm`/`npx`. No hace falta cambiar la política de ejecución del sistema. En PowerShell la carpeta puede crearse con `New-Item -ItemType Directory -Path apps -Force`.

**Verificación obligatoria tras generar:** instalar en la raíz y ejecutar el build/lint/pruebas disponibles. Si Node 26 presenta alguna incompatibilidad real con una dependencia, registrar el error y probar con Node 24 LTS antes de cambiar otras versiones del stack.

**Atención:** el CLI de Nest puede preguntar por ESM; elegirlo explícitamente. Antes de instalar dependencias, crear el `package.json` raíz con `private: true` y `workspaces: ["apps/*"]` (ver ejemplo abajo). Ambos CLI usan `--skip-git`, por lo que no deberían crear repositorios internos. Si apareciera uno, detenerse y comprobar la ruta antes de eliminar nada. No borrar el `.git` de la raíz. Los scaffolds pueden traer archivos propios como lockfiles: retirar lockfiles anidados antes del `npm install` único en la raíz.

```json
{
  "name": "pyme-stock-manager-tpi-icsw-2026",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev:api": "npm run start:dev -w apps/api",
    "dev:web": "npm run start -w apps/web",
    "build": "npm run build -w apps/api && npm run build -w apps/web",
    "lint:api": "npm run lint -w apps/api",
    "test:api": "npm run test -w apps/api"
  }
}
```

### Verificaciones ya realizadas (salidas compartidas el 29/10/2026, hora local)

- Monorepo instalado desde la raíz mediante `npm install`.
- Eliminación de `@nestjs/mau` porque no se utilizará su servicio de despliegue: `npm uninstall -D @nestjs/mau -w apps/api`.
- `npm audit`: **0 vulnerabilidades conocidas**, al momento de la verificación.
- `npm run build:api` y `npm run build:web`: correctos.
- `npm run lint`: backend y frontend sin errores.
- `npm run test:api`: 1 prueba del scaffold aprobada; `npm run test:web`: 2 pruebas del scaffold aprobadas.
- `npm run dev:api` y `npm run dev:web`: ambos servidores iniciaron. Apertura desde navegador pendiente de confirmar.
- Advertencia `npm install-scripts` para cuatro paquetes: se decidió **no aprobar scripts a ciegas**, dado que build, lint y tests funcionan.

Estas comprobaciones no prueban todavía reglas de negocio, autenticación ni conexión a base de datos. Tampoco sustituyen una ejecución posterior de CI.

El próximo trabajo técnico corresponde a [Issue #2](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/issues/2).

## 4. Invariantes que probar antes de dar por listo Inventory

- Sin movimiento no hay cambio de saldo.
- No se produce stock negativo ante dos salidas concurrentes.
- `INITIAL_BALANCE` solo puede ser primer movimiento por producto+ubicación, incluso ante dos solicitudes simultáneas.
- Entrada concurrente desde saldo inexistente se resuelve con insert/upsert único y sin perder cantidades.
- Producto `INACTIVE` y Location inactiva no reciben movimientos; inactivación concurrente no permite stock atrapado.
- Ajuste con motivo obligatorio y compensación mediante movimiento nuevo.
- Las salidas y las entradas cuentan diferente para demanda/rotación.

## 5. Gestión de documentación

- Los documentos `analisis_...` y `registro_...` son material técnico de referencia; la bitácora oficial la redacta el equipo, sin atribuir falsamente votaciones ni fechas.
- Corregir README: actualmente aparecen cinco nombres, las carpetas antiguas `/backend` y `/frontend`, y la transferencia se presenta como núcleo. Sabemos que el equipo real es de cuatro, pero no cuál nombre retirar.
- Planning Poker/SP sigue pendiente; se necesita **antes de cerrar capacidad e iteraciones**, no para comenzar el bootstrap.
- Primera estimación `148 UFP` no está metodológicamente validada; no planificar capacidad con ese número todavía.

## 6. Fuentes actuales

- https://docs.nestjs.com/techniques/session
- https://docs.nestjs.com/security/csrf
- https://www.prisma.io/docs/orm/release-status
- https://www.prisma.io/docs/v7/prisma-orm/quickstart/postgresql
- https://angular.dev/best-practices/security
- https://nodejs.org/en/about/previous-releases
- https://docs.nestjs.com/cli/usages
- https://docs.nestjs.com/migration-guide
- https://angular.dev/cli/new
