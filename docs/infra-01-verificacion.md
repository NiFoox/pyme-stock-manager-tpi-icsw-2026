# INFRA-01 — Verificación técnica

Verificaciones iniciales: 31/10/2026. Seguimiento PostgreSQL, auditoría y CI remoto: 02/11/2026.
Rama: chore/infra-foundation.
Base: 18e483a (bootstrap integrado mediante PR #3).

**Estado: verificaciones locales y CI/verify en GitHub aprobados; pendiente revisión
del PR #4. La auditoría del tooling conserva advertencias moderadas.**
La implementación está publicada en el [PR #4](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/pull/4),
abierto hacia main y todavía sin fusionar. Esta actualización solo registra
evidencia documental: no ejecuta tests locales ni modifica código, dependencias,
configuración o la bitácora del equipo; no hace nuevos commits ni push.

## Implementación y decisiones

- PostgreSQL 18.6-bookworm en Compose, persistencia de desarrollo, healthcheck y
  servicio de pruebas independiente con almacenamiento temporal.
- CLI, cliente y adaptador Prisma 7.10.1; pg 8.23.1 y dotenv 18.0.9.
  Se mantiene un lockfile raíz. La comparación del lockfile no encontró cambios
  de versión en los paquetes que ya existían.
- Esquema sin modelos. La ayuda de generate en la CLI instalada ofrece
  --require-models; prisma generate normal generó el cliente sin modelos.
  No se utiliza un flag heredado para permitir esquemas vacíos.
- Cliente TypeScript generado con moduleFormat esm e imports .js, compilado con
  el NodeNext existente. Artefactos generados excluidos de Git y lint.
- Servicio Prisma singleton, conexión diferida, timeout de conexión y cierre con
  el contexto NestJS. Diagnóstico compilado separado de la disponibilidad HTTP.
- GET /api/health público devuelve 200 y {"status":"ok"}, sin consultar PostgreSQL.
  Prefijo compartido por bootstrap y pruebas; contrato OpenAPI mínimo.
- Entorno de Compose separado del de API/CLI, prioridad de variables del proceso
  y rutas explícitas. Proxy Angular de desarrollo para /api/**.
- Comandos de migración preparados, sin ejecutar cambios de esquema. La primera
  reproducción completa se comprobará con el primer modelo real aprobado.
- Workflow para PR hacia main, con instalación, build, lint, pruebas, servicio
  PostgreSQL aislado y verificación del runtime compilado. CI/verify pasó en
  GitHub el 02/11/2026; ver [evidencia remota](#ci-remoto-verificado).

## Resultados obtenidos

Los resultados locales de build, lint, instalación limpia, HTTP, runtime y tests unitarios
son los registrados el 31/10. No se repitieron esas suites el 02/11: se ejecutaron
únicamente las comprobaciones pendientes de Docker/BD y la auditoría de dependencias.

| Comprobación | Resultado |
|---|---|
| Prisma 7.10.1: versión y ayuda de generate | Consultadas en la instalación real |
| npm run prisma:validate | Correcto |
| Generación sin modelos mediante prisma generate | Correcta, sin flags adicionales |
| npm ci en copia limpia | Correcto, sin node_modules, dist, cliente generado ni .env previos |
| npm run build en esa copia | Correcto para API y web |
| npm run lint en árbol de trabajo | Correcto para API y web |
| npm run lint:api tras el último ajuste HTTP | Correcto |
| npm run test:api | 11 pruebas aprobadas, también en copia limpia |
| npm run test:api:e2e | 2 pruebas aprobadas; último código comprobado en copia limpia |
| npm run test:web | 2 pruebas aprobadas en copia limpia |
| npm run test:api:runtime | Correcto en árbol de trabajo y copia limpia; ejecuta dist/main.js |
| Consulta HTTP manual al build compilado | 200 con {"status":"ok"}, con BD inalcanzable |
| docker compose --profile test config --quiet | Correcto, con variables desechables del proceso |
| YAML de CI y OpenAPI | Parseados/formateados con Prettier; esto no equivale a ejecutar Actions |
| Paso de argumentos de migración por workspaces | Ayuda de migrate dev invocada mediante el wrapper raíz; no se ejecutó migración |
| Diagnósticos del editor | Sin errores en los archivos comprobados |
| git diff --check | Sin errores de whitespace |
| npm run test:api:integration | 02/11: 1 prueba aprobada contra PostgreSQL real; fallo de conexión del 31/10 superado |
| npm run db:check | 02/11: correcto contra desarrollo y pruebas con el JavaScript compilado; SELECT 1 real |
| Inicio PostgreSQL mediante Compose | 02/11: db y db-test healthy, PostgreSQL 18.6 |
| Persistencia del volumen de desarrollo | 02/11: mismo clúster y volumen tras detener/iniciar, sin eliminar recursos |
| npm audit --json | 02/11: exit code 1, 19 entradas moderadas derivadas de un único advisory de minimatch |
| npm audit --omit=dev --json | 02/11: exit code 0, ninguna vulnerabilidad reportada en dependencias de producción |
| Ejecución remota GitHub Actions | 02/11: workflow CI y job verify completed/success en la [ejecución 41529783324](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/actions/runs/41529783324) |

La copia de verificación se creó dentro de .cache, ignorada por Git, e instaló sus
propias dependencias con npm ci. Se comprobó que prisma/config, NestJS, Prisma
Client y la configuración Vitest se resolvían desde esa instalación, sin recurrir
a node_modules del árbol principal.

Las pruebas HTTP y de runtime usan deliberadamente una URL de BD inalcanzable.
Su éxito demuestra disponibilidad HTTP y carga del cliente ESM compilado; **no
demuestra conectividad SQL**. La prueba de integración no se omite si falta la BD.

## CI remoto verificado

El 2 de noviembre de 2026, el workflow **CI** y su job **verify** terminaron con
estado completed y conclusión success en GitHub Actions:

- [PR #4](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/pull/4):
  chore/infra-foundation hacia main, abierto y sin fusionar.
- [Ejecución 41529783324](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/actions/runs/41529783324):
  evento pull_request, intento 1, asociado al PR #4.
- [Job verify](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/actions/runs/41529783324/job/125566675665):
  iniciado a las 21:36:01 UTC y finalizado a las 21:37:48 UTC del 02/11/2026.
- Commit verificado: 3d0163498cde3f8a9ae1bcb68e57d867f18324dd.

Los pasos de npm ci, validación de Compose/Prisma, build, lint, tests API, HTTP,
web e integración PostgreSQL concluyeron con success. También pasaron la consulta
SQL mediante Prisma/NestJS compilado y el smoke HTTP del runtime ESM compilado.
Esto aporta evidencia de ejecución remota en Linux con Node 26.13.0, además de
los resultados locales anteriores. No se repitieron tests locales para registrar
esta evidencia ni se modificó el workflow.

El éxito de CI no elimina las advertencias moderadas de minimatch ni sustituye
la revisión humana del PR. El riesgo y su seguimiento permanecen documentados.

## Seguimiento local del 02/11/2026

- Motor Docker operativo: cliente y servidor 29.9.2, motor Linux en Docker Desktop;
  Docker Compose v5.6.1. No fue necesario volver a iniciar o reconfigurar Docker.
- No existían los dos archivos de entorno locales. Se crearon desde sus ejemplos
  con contraseñas aleatorias criptográficas independientes, sin mostrar valores.
  Se usó creación exclusiva para impedir sobrescrituras; ambos están ignorados
  por Git. No se detectaron variables del proceso que reemplazaran esas URL o
  credenciales de Compose.
- npm run db:up descargó y levantó postgres:18.6-bookworm. Imagen verificada:
  postgres@sha256:5c4783a8cc3f0074912164f94dfa1be4e043438f0f707cf968d7af9a0d31a2c8.
- npm run db:test:up levantó una instancia separada. Ambas quedaron healthy:
  desarrollo en 127.0.0.1:5432 e integración en 127.0.0.1:5433.
- Se verificó PostgreSQL 18.6 (Debian 18.6-1.pgdg12+2) en desarrollo. El test de
  integración comprobó versión major 18 y base inventario_test mediante Prisma.
- npm run db:check utilizó el build ya existente de NestJS/Prisma y ejecutó
  SELECT 1 correctamente en desarrollo. También pasó seleccionando la URL de
  pruebas solo en el entorno del proceso, sin editar los archivos locales.
- npm run test:api:integration: 1 archivo, 1 prueba aprobada; duración 20,55 s.
  Su generación previa del cliente es parte del script existente. No se modificó
  la implementación ni se volvió a ejecutar build, lint o las suites ya aprobadas.
- El directorio de datos de desarrollo usa el volumen nombrado
  inventario-pyme_postgres_data en /var/lib/postgresql. La instancia de pruebas
  usa tmpfs en esa ruta, comprobado mediante HostConfig.Tmpfs y df -T; no comparte
  el volumen de desarrollo.
- La base de desarrollo tenía cero tablas en el esquema public. No se crearon
  tablas, modelos, seeds ni migraciones para estas verificaciones.

### Persistencia no destructiva

Se consultó SELECT system_identifier::text FROM pg_control_system() y se guardó
la identidad del contenedor y del volumen. Luego se ejecutó docker compose stop db
y docker compose up -d --wait db. Tras el healthcheck se repitió la consulta:

| Dato | Antes y después |
|---|---|
| Identificador del clúster | 7703674840410869811 |
| Volumen | inventario-pyme_postgres_data |
| Montaje | volume en /var/lib/postgresql |
| Identidad del contenedor | La misma, comprobada por su ID |
| Estado final | healthy |

La prueba cubre la persistencia tras una detención y arranque completos. No se
eliminó ni recreó el contenedor, no se borró el volumen y no se introdujeron datos
artificiales. Ambas instancias se dejaron levantadas y healthy para revisión.

### Revisión de las advertencias npm

El resumen inicial de instalación mencionaba dos advertencias moderadas. La
auditoría completa actual da un recuento distinto: 19 entradas afectadas, pero
un único advisory directo, propagado por las dependencias del tooling. No se
identificaron dos advisories independientes en el informe actual.

El paquete instalado es minimatch 10.2.6. El advisory
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
describe consumo excesivo de CPU/memoria al procesar patrones glob controlados
por un atacante con optimizationLevel >= 2. La versión corregida indicada es
11.0.1; supone un cambio mayor respecto de la rama 10 instalada.

Las rutas verificadas con npm ls minimatch --all son Nest CLI 12.0.11, ESLint
10.13.0/config-array y typescript-eslint/typescript-estree. Son herramientas de
desarrollo; npm audit --omit=dev no reportó vulnerabilidades. No se encontró una
dependencia de producción afectada por este advisory en la instalación actual;
esto no equivale a garantizar ausencia de vulnerabilidades futuras.

**Recomendación:** requiere corrección planificada del tooling y seguimiento del
riesgo de denegación de servicio ante patrones no confiables. No hay evidencia
de exposición del endpoint HTTP actual por este paquete. Buscar una actualización
compatible de los paquetes padres que incorpore la corrección; cualquier cambio
mayor o override fuera de sus rangos debe revisarse antes de aplicarlo.

No se ejecutó npm audit fix, no se usó --force ni se cambió ninguna dependencia.
Las sugerencias automáticas del informe incluyen un retroceso de Nest CLI a 11
y otras versiones fuera de los rangos establecidos: no constituyen una corrección
automática aceptable para el stack acordado. La auditoría completa sigue sin pasar;
su tratamiento queda explícitamente pendiente de revisión.

## Problemas encontrados y límites

- Docker Desktop estaba detenido. Los intentos iniciales de iniciar la aplicación
  no dejaron el motor disponible y el intento posterior por CLI fue rechazado.
  El 31/10 no se crearon contenedores ni se eliminaron volúmenes. Esta incidencia
  quedó superada en el seguimiento del 02/11: conexión SQL, imagen y persistencia
  tras detención/arranque verificadas con el motor restablecido por el usuario.
- Primer intento de tests Angular: timeout al iniciar un worker. Repetición
  aislada en la instalación limpia: dos pruebas aprobadas, sin cambiar versiones
  ni configuración Angular.
- Primer smoke: timeout de arranque a los 15 segundos. El margen quedó en 60
  segundos y las ejecuciones posteriores en ambos árboles pasaron.
- Una ejecución HTTP en frío superó el hook de 10 segundos. La suite ahora crea
  una sola aplicación y dispone de 30 segundos para inicialización; repetición
  con el último código: dos pruebas aprobadas.
- Una ejecución adicional de lint dentro de .cache no encontró archivos por la
  exclusión del repositorio padre. El lint de aceptación se ejecutó sobre el
  árbol de trabajo, incluyendo una repetición API tras el último cambio.
- npm advierte scripts de instalación sin aprobación para seis paquetes,
  incluyendo Prisma y sus engines. No se aprobaron scripts en bloque. La
  instalación limpia, generación y build Windows funcionaron con esa política.
  El comportamiento en Linux quedó verificado por CI/verify el 02/11/2026,
  sin que esta actualización cambie la política de scripts.
- npm audit --json devolvió exit code 1: advisory moderado de minimatch
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) y
  propagación por herramientas de desarrollo. No se declara auditoría limpia
  ni se ejecutaron correcciones forzadas o cambios mayores.
- Angular conserva su dependencia declarada Vitest 5 y la API Vitest 4.
  El builder Angular instalado resolvió el runner 4.1.12 mediante hoisting;
  su peer admite ^4.0.8 o ^5.0.0. No se modificó esa resolución existente.

## Pendientes para revisión y aceptación de INFRA-01

1. Completar la revisión y aprobación del PR #4; CI remoto ya está verificado.
2. Acordar el tratamiento y seguimiento de las advertencias moderadas de
   minimatch en el tooling. No se aplicó una actualización fuera de alcance.

La reproducción de migraciones de negocio continúa diferida hasta el primer
modelo real aprobado; no se genera una migración artificial para cerrar este hito.

No avanzar al siguiente Issue ni declarar terminado este hasta completar esas
verificaciones y la revisión del responsable.

## Archivos cambiados

| Estado | Archivo |
|---|---|
| Modificado | [.gitignore](../.gitignore) |
| Modificado | [README.md](../README.md) |
| Modificado | [apps/api/.oxlintrc.json](../apps/api/.oxlintrc.json) |
| Modificado | [apps/api/README.md](../apps/api/README.md) |
| Modificado | [apps/api/package.json](../apps/api/package.json) |
| Modificado | [apps/api/src/app.module.ts](../apps/api/src/app.module.ts) |
| Modificado | [apps/api/src/main.ts](../apps/api/src/main.ts) |
| Modificado | [apps/api/test/app.e2e-spec.ts](../apps/api/test/app.e2e-spec.ts) |
| Modificado | [apps/api/vitest.config.e2e.ts](../apps/api/vitest.config.e2e.ts) |
| Modificado | [apps/api/vitest.config.ts](../apps/api/vitest.config.ts) |
| Modificado | [apps/web/README.md](../apps/web/README.md) |
| Modificado | [apps/web/angular.json](../apps/web/angular.json) |
| Modificado | [docs/analisis_decisiones_arquitectonicas_v4.md](analisis_decisiones_arquitectonicas_v4.md) |
| Modificado | [docs/arquitectura.md](arquitectura.md) |
| Modificado | [docs/registro_decisiones_menores_v4.md](registro_decisiones_menores_v4.md) |
| Modificado | [docs/setup.md](setup.md) |
| Modificado | [package-lock.json](../package-lock.json) |
| Modificado | [package.json](../package.json) |
| Nuevo | [.env.example](../.env.example) |
| Nuevo | [.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| Nuevo | [apps/api/.env.example](../apps/api/.env.example) |
| Nuevo | [apps/api/prisma.config.ts](../apps/api/prisma.config.ts) |
| Nuevo | [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma) |
| Nuevo | [apps/api/scripts/smoke-runtime.mjs](../apps/api/scripts/smoke-runtime.mjs) |
| Nuevo | [apps/api/src/config/environment.spec.ts](../apps/api/src/config/environment.spec.ts) |
| Nuevo | [apps/api/src/config/environment.ts](../apps/api/src/config/environment.ts) |
| Nuevo | [apps/api/src/configure-app.ts](../apps/api/src/configure-app.ts) |
| Nuevo | [apps/api/src/database/check-connection.ts](../apps/api/src/database/check-connection.ts) |
| Nuevo | [apps/api/src/database/database.module.ts](../apps/api/src/database/database.module.ts) |
| Nuevo | [apps/api/src/database/prisma.service.ts](../apps/api/src/database/prisma.service.ts) |
| Nuevo | [apps/api/src/health/health.controller.ts](../apps/api/src/health/health.controller.ts) |
| Nuevo | [apps/api/test/database.integration-spec.ts](../apps/api/test/database.integration-spec.ts) |
| Nuevo | [apps/api/vitest.config.integration.ts](../apps/api/vitest.config.integration.ts) |
| Nuevo | [apps/web/proxy.conf.json](../apps/web/proxy.conf.json) |
| Nuevo | [compose.yml](../compose.yml) |
| Nuevo | [docs/openapi.yaml](openapi.yaml) |
| Nuevo | [docs/infra-01-verificacion.md](infra-01-verificacion.md) |

Archivos retirados del ejemplo Hello World:

- apps/api/src/app.controller.spec.ts
- apps/api/src/app.controller.ts
- apps/api/src/app.service.ts

No se agregaron modelos, seeds, archivos de migración ni módulos de dominio.
