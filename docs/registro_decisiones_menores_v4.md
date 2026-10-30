# TPI Inventario PyME — Registro técnico de decisiones menores v3

**Actualizado:** 29/10/2026. **Estado:** inventario de decisiones de diseño discutidas/propuestas; sujeto a validación del equipo. **No es la bitácora de decisiones exigida por la cátedra.**

## Estados

- **BASE:** línea base técnica actual para el diseño; puede revisarse con el equipo.
- **COND:** requiere regla/caso de uso preciso antes de implementar.
- **FUT:** posible ampliación, no comprometida en v1.
- **NO-V1:** deliberadamente fuera del alcance inicial.

## Producto, catálogo y roles

| ID | Estado | Decisión / regla | Razón breve |
|---|---|---|---|
| DOM-001 | BASE | Producto: inventario PyME, no ERP | Controlar alcance |
| DOM-002 | BASE | 5 módulos conceptuales (Identity, Catalog, Inventory, Replenishment, Reporting) | Límites del negocio |
| DOM-003 | BASE | `Location` genérica para Local, Depósito y futuros lugares | No columnas fijas |
| DOM-004 | BASE | Un producto = una categoría directa | Árbol y métricas sin doble conteo |
| DOM-005 | BASE | Categorías con `parentId` opcional | Jerarquía variable |
| DOM-006 | BASE | Categoría no equivale a grupo de productos sustituibles | Compras decide sustituciones |
| DOM-007 | NO-V1 | `GrupoReposición` | Complejidad comercial no validada |
| DOM-008 | BASE | Producto `ACTIVE`, `DISCONTINUED`, `INACTIVE` | Ciclo de vida explícito |
| DOM-009 | BASE | `DISCONTINUED` puede vender/consumir stock | Liquidación de existencia |
| DOM-010 | BASE | `DISCONTINUED` no se repone automáticamente | Retirado comercialmente |
| DOM-011 | BASE | `INACTIVE` = baja lógica (sin otro booleano) | Una fuente de verdad |
| DOM-012 | BASE | Impedir inactivar producto con saldo global positivo | No bloquear mercadería |
| DOM-013 | BASE | Reactivación explícita y controlada | Cambios del negocio |
| DOM-014 | BASE | Usuario y ubicación con `active` | Trazabilidad histórica |
| DOM-015 | BASE | No desactivar ubicación con stock positivo | No perder existencias |
| DOM-016 | BASE | No desactivar categoría con hijos activos/productos operativos | Catálogo consistente |
| DOM-017 | BASE | Dos roles `ADMIN`/`OPERATOR` | Requisito TPI, KISS |
| DOM-018 | BASE | No desactivar/degradar último ADMIN activo | Evitar bloqueo de administración |
| DOM-019 | FUT | Reservas de stock para reparación | Necesidad futura a validar |
| DOM-020 | FUT | Stock no disponible/garantías | Necesidad futura a validar |
| DOM-021 | FUT | Proveedores, órdenes, facturación | Evolución hacia ERP |

## Persistencia y operaciones de inventario

| ID | Estado | Decisión / regla | Razón breve |
|---|---|---|---|
| DB-001 | BASE | PK `BIGINT GENERATED AS IDENTITY` | Simplicidad para sistema local |
| DB-002 | BASE | Instantes como `TIMESTAMPTZ`; almacenar UTC | Tiempo no ambiguo |
| DB-003 | BASE | Día civil de reportes: `America/Argentina/Cordoba`; instantes almacenados en UTC | Agrupar demanda por fecha local |
| DB-004 | BASE | Cantidades `INTEGER` de unidades enteras | Dominio inicial |
| DB-005 | BASE | 7 tablas dominio: users, categories, products, locations, stock_balances, inventory_movements, replenishment_policies | MVP suficiente |
| DB-006 | BASE | `UNIQUE(product_id, location_id)` en saldos | Un saldo por combinación |
| DB-007 | BASE | `CHECK(quantity >= 0)` | Stock físico no negativo |
| DB-008 | BASE | `StockBalance` se crea al primer uso real | Evita combinaciones vacías |
| DB-009 | BASE | Sin fila de saldo = cero en lectura | Semántica consistente |
| DB-010 | BASE | Stock global calculado de saldos | No duplicar total |
| DB-011 | BASE | `InventoryMovement` inmutable para usuario/API | Preservar historial |
| DB-012 | BASE | Movimiento + saldo en misma transacción | Integridad |
| DB-013 | BASE | Producto se crea sin cantidad inicial | No omitir ledger |
| DB-014 | BASE | `INITIAL_BALANCE` para arranque del sistema | Inventario previo ya existente |
| DB-015 | BASE | `INITIAL_BALANCE` permitido cualquier día, cargando gradualmente | No se inventaría todo de una vez |
| DB-016 | BASE | Solo primer movimiento **de esa pareja producto–ubicación** puede ser `INITIAL_BALANCE` | No confundir con correcciones posteriores |
| DB-017 | BASE | `INITIAL_BALANCE` crea de forma exclusiva la primera fila de saldo en una transacción; `UNIQUE(product,location)` arbitra carreras; jamás borrar saldo cero una vez inicializado | Evitar inicializaciones dobles o tardías |
| DB-018 | BASE | Tipo de movimiento: `INITIAL_BALANCE`, `ENTRY`, `EXIT`, `ADJUSTMENT` | Mínimo útil |
| DB-019 | BASE | `quantityDelta` con signo; distinto de cero | Variación explícita |
| DB-020 | BASE | `ENTRY`/`INITIAL_BALANCE` positivo, `EXIT` negativo | Semántica coherente |
| DB-021 | BASE | Ajuste por delta; motivo obligatorio | Auditoría |
| DB-022 | BASE | Errores históricos se compensan con nuevo movimiento | No editar pasado |
| DB-023 | BASE | No crear endpoints UPDATE/DELETE para movimientos | Inmutabilidad operativa |
| DB-024 | FUT | Trigger/privilegios DB para reforzar inmutabilidad | Hardening si se necesita |
| DB-025 | BASE | Salidas/ajustes negativos con decremento condicional atómico | Concurrencia segura |
| DB-026 | BASE | En salida sin saldo o saldo insuficiente: rechazo coherente (`409`) | Nunca negativo |
| DB-027 | BASE | Entradas concurridas usan creación segura del saldo (`upsert` o similar) | Evitar violar UNIQUE |
| DB-028 | BASE | Índices por consultas conocidas; revisar `EXPLAIN` más adelante | No sobreindexar |
| DB-029 | FUT | Correlation/correction ID si se exige auditoría más fina | Vínculo de correcciones |
| DB-030 | NO-V1 | Histórico general de snapshots | Primero medir performance |

## Categorías y productos

| ID | Estado | Decisión / regla | Razón breve |
|---|---|---|---|
| CAT-001 | BASE | La raíz tiene `parentId = NULL` | Árbol |
| CAT-002 | BASE | Rechazar autovínculos y ciclos | Jerarquía válida |
| CAT-003 | BASE | Nombre de categoría único por padre, no global | Permite nombres repetidos en ramas distintas |
| CAT-004 | BASE | No reutilizar nombre de categoría inactiva en el mismo padre | Evitar identidad ambigua |
| CAT-005 | BASE | Índice único de PostgreSQL 15+ `(parent_id, lower(btrim(name))) NULLS NOT DISTINCT` en migración SQL | Raíces, mayúsculas y espacios normalizados |
| CAT-006 | BASE | SKU único y no reutilizable tras baja lógica | Identificador estable |
| CAT-007 | BASE | Marca/modelo son texto opcional en v1 | Evitar tablas sin necesidad |
| CAT-008 | BASE | Paginación/filtrado de productos en backend | No descargar todo el catálogo |

## Reposición y métricas

| ID | Estado | Decisión / regla | Razón breve |
|---|---|---|---|
| REP-001 | BASE | Política por SKU, máximo una vigente | KISS |
| REP-002 | BASE | Sin política = nunca configurada; política disabled = desactivada | Semántica distinta |
| REP-003 | BASE | PR manual y automático | Compatibilidad con demanda dispersa |
| REP-004 | BASE | `DMD = salidas válidas / días` | Método explicable |
| REP-005 | BASE | `PR = ceil(DMD × leadTime + safetyStock)` | Primera fórmula simple |
| REP-006 | BASE | PR externo se evalúa contra stock global | Evita compra si hay en depósito |
| REP-007 | BASE | Objetivo configurado y sugerencia `max(0, objetivo - stockGlobal)` | Decisión humana de cuánto recuperar |
| REP-008 | BASE | Política incoherente si `targetStock <= PR` efectivo | Evitar sugerencia 0 con alerta de stock |
| REP-009 | BASE | Coherencia en modo auto se revisa al calcular; no autocorregir | PR dinámico |
| REP-010 | BASE | No generar compra/orden automáticamente | Fuera de alcance |
| REP-011 | BASE | No persistir sugerencias/listas de reposición inicialmente | Frontend temporal |
| REP-012 | BASE | Ventanas UI 30/60/90, campo persistido entero | UX simple y flexible |
| REP-013 | BASE | PR automático exige ventana completa desde primer movimiento registrado de producto; antes estado `INSUFFICIENT_HISTORY` y opción manual | Evitar promedios sobre períodos no observados |
| REP-014 | BASE | Con observación suficiente y cero salidas, demanda 0 y `PR=safetyStock` | No inventar consumo |
| REP-015 | BASE | Con `PR=0` no mostrar crítico aunque stock=0; para alertar hay que configurar PR positivo | Evitar alertas triviales por ausencia de demanda |
| REP-016 | BASE | Producto discontinuado/inactivo sin sugerencia de compra | Ciclo de vida |
| MET-001 | BASE | Datos de demanda/rotación calculados desde `EXIT` | Distinguir consumo real |
| MET-002 | BASE | Entradas, carga inicial, ajustes y futuras transferencias no cuentan como demanda | Evitar sesgo |
| MET-003 | BASE | Reportar consumo total, eventos, días con consumo, fecha última salida, frecuencia | Transparencia |
| MET-004 | BASE | Frecuencia = días con consumo/días del período | Interpretación sencilla |
| MET-005 | BASE | Clase NULA=0; BAJA (0,10%]; MEDIA (10%,30%]; ALTA >30% | Heurística inicial revisable |
| MET-006 | BASE | Aclarar que frecuencia **no es** la tasa clásica contable de rotación | Precisión conceptual |
| MET-007 | FUT | Cobertura, riesgo de quiebre, exceso y concentración | Complementos |
| MET-008 | NO-V1 | Snapshots diarios/materialized views automáticos | Sin necesidad medida |

## Autenticación, API y seguridad

| ID | Estado | Decisión / regla | Razón breve |
|---|---|---|---|
| SEC-001 | BASE | Sesión servidor + cookie `HttpOnly` | Revocación simple |
| SEC-002 | BASE | `Secure` con HTTPS en producción; `SameSite=Lax` previsto para mismo sitio | Cookies seguras sin romper navegación |
| SEC-003 | BASE | Despliegue mismo origen (`/api` detrás de proxy); activar protección CSRF nativa NestJS 12.1+ y probarla | Protección de mutaciones y cookies sin CORS de credenciales |
| SEC-004 | BASE | Hash de contraseñas con Argon2id | Password hashing robusto |
| SEC-005 | BASE | Session store PostgreSQL v1 | Persistencia sin Redis inicial |
| SEC-006 | BASE | NestJS 12.1+ Express, `express-session` y `connect-pg-simple` en PostgreSQL, separado del dominio | Sesiones persistentes y revocables |
| SEC-007 | BASE | Autorización en backend; los botones ocultos son solo UX | Control real |
| SEC-008 | BASE | No exponer hash de contraseña, secretos o stacks internos | Protección de información |
| API-001 | BASE | API HTTP/JSON REST para recursos CRUD | Interfaz convencional |
| API-002 | BASE | Endpoints de intención de negocio para entradas/salidas/ajustes | Reglas diferenciadas |
| API-003 | BASE | `GET /auth/me` para hidratar sesión web | Frontend no lee cookie secreta |
| API-004 | BASE | No stock en POST /products | Stock siempre por movimientos |
| API-005 | BASE | Paginar con `page/pageSize` (20, máximo 100) | Evitar respuestas enormes |
| API-006 | BASE | Error `{code,message,details?,requestId?}` sin filtrado de stack/SQL | Cliente consistente |
| API-007 | BASE | DTO de entrada/salida; no exponer entidades Prisma directamente | Contrato delimitado |
| API-008 | BASE | No usar `/v1` en URL inicialmente | No hay versiones públicas paralelas |
| API-009 | COND | Contrato HTTP común fijado (400/401/403/404/409 + esquema error); DTO de cada caso se detalla al implementarlo | No anticipar 30 contratos triviales |

## Testing, trabajo y evolución

| ID | Estado | Decisión / regla | Razón breve |
|---|---|---|---|
| QA-001 | BASE | Unit tests para cálculos/reglas puras | Feedback rápido |
| QA-002 | BASE | Tests API/integración con PostgreSQL real | Verificar constraints/ACID |
| QA-003 | BASE | Probar carreras por última unidad y rollback de movimientos | Riesgo crítico |
| QA-004 | BASE | Unos pocos E2E críticos con Playwright | Cobertura integral sin exceso |
| QA-005 | BASE | **Vitest/Supertest** para NestJS ESM | Scaffold oficial de NestJS 12; Supertest mantiene tests HTTP |
| QA-006 | BASE | CI con lint/build inicialmente; tests progresivos | Evidencia de calidad |
| QA-007 | BASE | Sin % de coverage obligatorio antes de medir baseline | Evitar número arbitrario |
| CFG-001 | BASE | Monorepo y GitHub, ramas cortas, Issues, PR/CI | Trazabilidad |
| CFG-002 | BASE | Git convencional `feat/fix/docs/test/chore` | Simplicidad |
| CFG-003 | NO-V1 | GitFlow pesado, CQRS, Event Bus, NgRx, Repository universal, microservicios | YAGNI |
| CFG-004 | BASE | Documentación técnica viva en `/docs`; consolidado Word/PDF opcional | Una fuente de verdad |
| CFG-005 | BASE | ADR extensos para claves; tabla para menores | Registro proporcional |
| CFG-006 | BASE | Compose conceptual: PostgreSQL, API, web | Entorno reproducible |
| CFG-007 | BASE | Equipo de **cuatro**; Planning Poker de cuatro votos, aún pendiente | No inventar estimaciones |
| CFG-008 | COND | Plan de iteraciones final tras votos/capacidad del equipo | No bloquear arquitectura/implementación |
| EVO-001 | FUT | Redis como almacenamiento de sesiones | Aprender sesión distribuida |
| EVO-002 | FUT | Redis cache **solo tras medir consulta candidata** | Aprender invalidación y TTL |
| EVO-003 | FUT | BullMQ + Redis para trabajo de fondo real | Aprender colas/reintentos |
| EVO-004 | FUT | JWT access/refresh/rotación/revocación | Comparar modelo con sesiones |
| EVO-005 | FUT | Varias instancias API; rate limiting distribuido | Aprender escalabilidad |
| EVO-006 | FUT | Transferencia simple P1; decidir entidad dedicada cuando se diseñe | No anticipar flujos de tránsito |

---

## Próximas verificaciones recomendadas, por orden de impacto

1. **Antes de auth:** origen/esquema HTTPS de frontend/API; session store; cookie+CSRF; estado actual del usuario; requisitos de logout y sesión expirada.
2. **Antes de inventario:** atomicidad de inicialización, incremento concurrente y decremento condicional; estados/bajas compitiendo con movimientos.
3. **Antes de reposición:** observación de demanda en ventanas, caso `PR=0`, regla objetivo vs PR y comportamiento de listado en políticas inválidas.
4. **Antes de rotación:** definición de día según zona local, clase por frecuencia vs rotación contable, ejemplos con salidas acumuladas en un solo día.
5. **Antes de cerrar E2:** SP de los cuatro, estimación PF revisada, capacidad, dependencias e iteraciones.

> La bitácora oficial debe redactarla el grupo. Este registro es una lista de trabajo verificable, **no evidencia de discusión ni decisión adoptada por integrantes específicos**.


## Adiciones del 23/10/2026 (integradas a la línea base recomendada)

| ID | Estado | Decisión / regla | Razón breve |
|---|---|---|---|
| DB-031 | BASE | Producto y ubicación se bloquean dentro de la misma transacción que valida estado y registra variaciones de stock | Evita altas concurrentes con inactivaciones |
| DB-032 | BASE | No borrar `StockBalance` al volver a cero; la fila indica que ya hubo movimientos | Refuerza regla de primer saldo inicial |
| REP-017 | BASE | Si política automática queda incoherente, reportar necesidad pero no calcular sugerencia utilizable; solicitar revisión | Mostrar riesgo sin inventar compra |
| SEC-009 | BASE | Consultar estado actual y rol de `User` para autorizar cada operación; sesión almacena identificador, no permisos definitivos | Revocación y permisos efectivos |
| SEC-010 | BASE | Regenerar sesión al login, invalidarla al logout, limitar duración y proteger cookie | Evitar fijación y sesiones indefinidas |
| SEC-011 | BASE | Node.js **26 LTS (26.13.0 objetivo)** + NestJS 12.1.x+ + Angular 22 + Prisma 7.10.1 estable | Línea base actualizada el 29/10; verificar instalación/build/tests antes de dar compatibilidad por confirmada |
| SEC-012 | FUT | Token CSRF adicional si requieren clientes/navegadores no cubiertos por protección de origen nativa | Defensa complementaria, no sustituye validación de origen |
| CFG-009 | BASE | npm workspaces; `/apps/api`, `/apps/web`, `/docs` para monorepo | Reemplaza las rutas iniciales del README; estructura por aplicaciones |
| CFG-010 | COND | README tiene cinco integrantes y transferencias como principal; actualizar cuando se identifique al integrante excluido y se confirme alcance P1 | Documentación debe coincidir con proyecto |
| PLAN-013 | COND | `148 UFP` solo aproximación metodológica; verificar clasificación DET/FTR/RET y funciones elementales | Evitar falsa precisión |

**Nota operativa:** Las decisiones de implementación aquí elegidas son recomendaciones técnicas concretas. La adopción/documentación oficial del grupo exige registrar su propio razonamiento, participantes y fecha real.


## Actualización de scaffolding — 29/10/2026

| ID | Estado | Decisión / regla | Motivo |
|---|---|---|---|
| CFG-011 | BASE | `/apps/api` y `/apps/web` sustituyen `/backend` y `/frontend` | Organización consistente por aplicaciones, no por nombres genéricos |
| CFG-012 | BASE | Backend NestJS **modo estándar**, no NestJS monorepo mode | Una sola aplicación NestJS |
| CFG-013 | BASE | Un `package.json` privado en raíz + npm workspaces + un `package-lock.json` raíz | Scripts y dependencias coordinadas |
| CFG-014 | NO-V1 | No introducir Nx/Turborepo | No hay complejidad de builds que lo exija |
| CFG-015 | NO-V1 | No crear `/packages` sin código realmente compartible | Evitar abstracciones vacías |
| CFG-016 | BASE | Usar generadores oficiales CLI para API y web; no copiar boilerplate artesanal | Convenciones actuales y mantenimiento |
| QA-008 | BASE | NestJS 12 **ESM** con **Vitest** y **oxlint** del scaffold; Supertest en integración HTTP | Aprovechar toolchain oficial actual |
| QA-009 | BASE | No imponer a Angular el mismo lint o runner del backend | Cada app conserva tooling adecuado a su framework |
| DOC-001 | COND | Actualizar README que contiene rutas viejas y cinco nombres; falta identificar el integrante excluido | No inventar identidad ni afirmar equipo falso |

**Corrección respecto de v2:** la referencia `Jest/Supertest` y las rutas `/frontend` y `/backend` quedaron reemplazadas. Las demás decisiones de dominio no se alteran. El archivo mantiene el valor de inventario técnico, no una bitácora de discusiones ficticias.


## Actualización de runtime — 29/10/2026 (v4)

| ID | Estado | Decisión / regla | Motivo |
|---|---|---|---|
| CFG-017 | BASE | Runtime objetivo **Node.js 26 LTS (26.13.0)** y npm incluido con esa instalación | Nuevo proyecto sin dependencias instaladas; estandarización del equipo |
| CFG-018 | RESPALDO | Mantener Node 24 LTS disponible en NVM | Permite revertir ante incompatibilidad reproducible sin cambiar diseño |
| QA-010 | POR VALIDAR | Ejecutar instalación, build, lint y pruebas con Node 26 antes de fijar el runtime en CI | LTS no garantiza compatibilidad específica de cada dependencia |
| CFG-019 | BASE | En PowerShell con `npm.ps1` bloqueado, usar `npm.cmd` y `npx.cmd` o trabajar desde CMD | No es necesario relajar las políticas de ejecución de Windows |
