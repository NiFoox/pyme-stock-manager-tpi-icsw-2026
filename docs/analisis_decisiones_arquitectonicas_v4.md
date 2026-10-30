# TPI Inventario PyME — Análisis de decisiones arquitectónicas v3 — recomendación técnica para implementación

**Fecha de revisión:** 29/10/2026
**Naturaleza:** selección técnica recomendada para implementar y explicación de alternativas; **no constituye una bitácora de deliberaciones del equipo**.
**Equipo:** 4 integrantes.
**Alcance:** MVP/P0.
**Origen:** análisis de requisitos, Mural/discovery y decisiones de diseño trabajadas; alternativas técnicas razonables sugeridas para discusión.

> **Importante (consigna TPI, §§5.1–5.3 y 6):** está permitido usar IA como apoyo para generar ideas iniciales, revisar textos y explicar tecnologías; está prohibido delegar a IA la redacción de la bitácora. La bitácora oficial `/docs/decisiones.md` debe ser redactada por los integrantes a partir de su discusión auténtica, con fecha de adopción, proponente, participantes, decisión, **dos alternativas además de la elegida** y criterios. Ni las alternativas ni las fechas de deliberación que aparecen aquí deben presentarse falsamente como debatidas por el grupo.

## Alcance y glosario

- **MVP/P0:** usuarios y roles, categorías/productos, ubicaciones, saldo por ubicación, movimientos/ajustes/historial, reposición calculada, rotación.
- **P1/futuro:** transferencias internas, cobertura, análisis por categoría, reservas, proveedores/compras, Redis y JWT como ejercicios.
- **Decisión propuesta:** es la recomendación actual, susceptible de rectificación por el equipo.
- **Invariante:** propiedad que el sistema debe mantener, aun ante errores y concurrencia.
- **ADR:** *Architecture Decision Record*, registro individual de una decisión con contexto, alternativas, consecuencias y disparadores de revisión.

---

## CAND-ADR-001 — Monolito modular para el backend

**Problema.** Necesitamos límites claros entre autenticación, catálogo, inventario, reposición y reportes sin complejidad operacional desproporcionada.

**Selección propuesta.** Un backend NestJS único, estructurado en módulos de dominio: `Identity`, `Catalog`, `Inventory`, `Replenishment` y `Reporting`.

**Otras alternativas razonables (para evaluar, no reuniones ya celebradas):**
1. Monolito sin modularización sustancial, agrupado por controlador/modelo global: menos estructura inicial, mayor riesgo de acoplamiento.
2. Microservicios por dominio: independencia de despliegue y escalado, pero contratos distribuidos, observabilidad, fallos de red y coordinación de datos innecesarios aquí.

**Criterio.** Complejidad mínima compatible con responsabilidad clara, mantenibilidad y una aplicación pequeña de un equipo de cuatro personas.

**Consecuencias.** Despliegue y transacciones simples; evolución interna por módulos. Se debe cuidar que `shared/common` no se transforme en un repositorio de lógica de negocio transversal.

**Reevaluar cuando:** aparezcan límites de escalabilidad reales, equipos independientes o necesidades de despliegue autónomo.

**Relacionada con:** US-01..US-15, arquitectura general.

## CAND-ADR-002 — Angular + NestJS + TypeScript y API REST

**Problema.** Elegir tecnologías conocidas/aprendibles, con estructura clara y un contrato estable entre web y API.

**Selección propuesta.** Angular/TypeScript para SPA; NestJS/TypeScript para backend; HTTP/JSON sobre REST con DTO y OpenAPI.

**Otras alternativas:**
1. Angular + Express sin NestJS: control directo y menor abstracción, pero más convenciones y organización a cargo del equipo.
2. React + Fastify/Express: ecosistema sólido y flexibilidad, con mayor costo de aprendizaje/cambio de stack en este proyecto.

**Criterio.** Continuidad con conocimientos de Angular/TypeScript/Express y objetivo educativo de aprender estructura/DI de NestJS.

**Consecuencias.** Validación/serialización de DTO explícita, versionado de contratos internos y coordinación de errores. NestJS no reemplaza análisis del dominio ni seguridad.

**Reevaluar cuando:** la SPA no sea necesaria o aparezca una API pública/clientes móviles con exigencias distintas.

## CAND-ADR-003 — PostgreSQL como base relacional

**Problema.** Mantener integridad transaccional entre saldos y movimientos, claves foráneas y consultas históricas. El TPI exige una base relacional.

**Selección propuesta.** PostgreSQL.

**Otras alternativas:**
1. MariaDB/MySQL: relacional y viable, pero menor familiaridad del equipo y variaciones en capacidades/SQL.
2. SQLite: muy simple para prototipos, pero distinta operación/concurrencia respecto del despliegue pretendido.

**Criterio.** Restricción académica, ACID, constraints/índices y experiencia previa del equipo.

**Consecuencias.** Migraciones, copias de seguridad y pruebas con PostgreSQL real; evitar depender de comportamiento de un mock o de SQLite para probar concurrencia.

## CAND-ADR-004 — Prisma como acceso principal a datos, SQL cuando corresponda

**Problema.** Persistencia tipada y mantenible sin escribir SQL para todos los CRUD, pero sin ocultar consultas/actualizaciones críticas.

**Selección propuesta.** Prisma Client + migraciones versionadas; SQL explícito si una operación atómica/consulta requiere semántica que Prisma no exprese cómodamente.

**Otras alternativas:**
1. TypeORM: integración común en NestJS, pero otro estilo de entidades y persistencia.
2. SQL con `pg` o query builder: máximo control, a costa de más código repetitivo y mantenimiento para CRUD.

**Criterio.** Productividad, tipado y transparencia suficiente sobre transacciones/SQL crítico.

**Consecuencias.** No asumir que métodos ORM son mágicamente atómicos; inspeccionar SQL y probar restricciones/concurrencia. Evitar Repository Pattern universal sin una necesidad real.

## CAND-ADR-005 — Sesiones de servidor en vez de JWT para la v1

**Problema.** Autenticar usuarios del navegador, con cierre/revocación sencilla y dos roles fijos, sin API pública.

**Selección propuesta.** Cookie con identificador de sesión opaco; sesión persistida en PostgreSQL; NestJS valida sesión/autorización en backend. Cookies `HttpOnly`, `Secure` bajo HTTPS y `SameSite=Lax` para un despliegue **de mismo origen** (web y `/api` servidas bajo el mismo host mediante proxy).

**Otras alternativas:**
1. JWT bearer entregado al frontend y guardado en `localStorage`: despliegue simple, pero el token accesible a JS es exfiltrable ante XSS y la revocación requiere diseño adicional.
2. JWT en cookie `HttpOnly` con access/refresh tokens: reduce acceso por JS, pero añade rotación/revocación de refresh tokens y **no elimina automáticamente el riesgo CSRF por usar cookies**.

**Criterio.** App web única, revocación inmediata, menor superficie de diseño inseguro y aprendizaje gradual.

**Consecuencias / cautelas.**
- Sesiones no eliminan XSS; `HttpOnly` impide leer la cookie desde JS, pero un XSS aún puede actuar como usuario desde el mismo origen.
- Para la v1 con NestJS 12.1+, habilitar protección CSRF integrada basada en `Sec-Fetch-Site`/`Origin`; evitar endpoints GET mutantes; probar rechazos cross-origin. Un token CSRF es una posible defensa adicional si surgen clientes o navegadores que lo requieran. No confundir CORS con protección CSRF. Regenerar el ID al iniciar sesión y configurar expiración.
- `SameSite` depende del **sitio** (no exactamente del mismo origen); verificar topología Angular/API antes de fijar atributos definitivamente.
- Un usuario desactivado debe perder acceso; resolver invalidación de sesiones o comprobación de estado vigente.
- Redis como session store figura en backlog de aprendizaje, no es requisito MVP.

**Reevaluar cuando:** se requieran clientes móviles, autorización delegada, terceros o múltiples instancias/alto volumen de sesiones.

## CAND-ADR-006 — Dos roles fijos y control de acceso del lado del servidor

**Problema.** El TPI exige dos roles diferenciados. No hay permisos configurables por negocio.

**Selección propuesta.** Enum `ADMIN | OPERATOR` en `User`, guards/autorización por operación en backend.

**Otras alternativas:**
1. Tablas `Role`, `Permission`, `RolePermission`: extensibles, pero agregan gestión y mantenimiento para un problema inexistente.
2. Autorización solamente mediante ocultar opciones en Angular: menos backend aparente, pero insegura y no aceptable como mecanismo único.

**Criterio.** Necesidad actual y mínimo principio de privilegio. UI puede esconder acciones por usabilidad, nunca como frontera de seguridad.

**Consecuencias.** Probar 401/403, impedir desactivar/degradar al último administrador activo; si esto se hace bajo concurrencia requiere transacción/serialización del cambio.

## CAND-ADR-007 — Ledger de movimientos + saldo operacional persistido

**Problema.** Se necesita stock consultable rápidamente y trazabilidad de cada variación.

**Selección propuesta.** `InventoryMovement` inmutable en operaciones normales más `StockBalance(productId,locationId)`; ambos se escriben dentro de una única transacción.

**Otras alternativas:**
1. Solo saldo actual: simple y rápido, pero sin explicación histórica para diferencias.
2. Solo historial de movimientos y saldo calculado por `SUM(delta)` para cada lectura: máxima derivación histórica, pero consultas frecuentes más costosas y mayor complejidad operativa.

**Criterio.** Confiabilidad operativa + auditabilidad + rendimiento de lecturas frecuentes.

**Consecuencias.** Redundancia deliberada: deben existir controles transaccionales, pruebas e idealmente una rutina de conciliación diagnóstica `saldo persistido vs suma de movimientos`. No afirmar que este diseño sea Event Sourcing.

**Reevaluar cuando:** escala/consultas justifiquen proyecciones materializadas adicionales o auditoría más fuerte.

## CAND-ADR-008 — Descuento condicional atómico y transaccional

**Problema.** Dos operadores podrían intentar retirar simultáneamente la última unidad.

**Selección propuesta.** `UPDATE stock_balances SET quantity = quantity - :n WHERE product_id=:p AND location_id=:l AND quantity >= :n`; comprobar una fila afectada; insertar movimiento en **la misma transacción**.

**Otras alternativas:**
1. Bloqueo explícito `SELECT ... FOR UPDATE` y cálculo bajo transacción: viable y robusto, pero más pasos/bloqueo explícito para una regla sencilla.
2. Optimistic locking con columna de versión y reintentos: útil con varias escrituras concurrentes, pero aquí introduce un protocolo extra sin beneficio inicial claro.

**Criterio.** Corrección verificable, atomicidad y simplicidad para operaciones de stock.

**Consecuencias / detalles por resolver al implementar.**
- Manejar `StockBalance` aún inexistente: entrada crea saldo con `UPSERT`/manejo seguro de UNIQUE; salida sin fila = insuficiente.
- Prevenir dobles envíos de clientes si se observa necesidad (idempotency keys), separado de carreras por saldo.
- Ajustes negativos usan el mismo principio de decremento seguro.
- Probar dos requests concurrentes reales contra PostgreSQL; comprobar exactamente un éxito si queda una unidad.

## CAND-ADR-009 — Reposición simple por SKU (sin flujo de compras)

**Problema.** Ayudar al usuario a saber cuándo y cuánto reponer, sin automatizar decisiones comerciales complejas.

**Selección propuesta.** Política por producto, modo manual o automático; PR automático basado en demanda media diaria, lead time y stock de seguridad; objetivo configurado; sugerencias calculadas para stock **global**.

**Otras alternativas:**
1. Grupos de reposición por productos supuestamente sustituibles: podría reducir compras repetidas, pero traslada decisiones comerciales de sustitución al sistema.
2. Workflow integral de compra, aprobación, órdenes y recepciones parciales: más trazabilidad de compras, pero excede el alcance de inventario MVP.

**Criterio.** Hipótesis validable, bajo costo de uso y concordancia con el proceso no trivial del TPI.

**Consecuencias y escenarios de revisión.**
- No persistir `Suggestion`/`ReplenishmentBatch` inicialmente.
- `PR = ceil(DMD*leadTime + safetyStock)`; `cantidad = max(0, targetStock - stockGlobal)`.
- Si `targetStock <= PR` efectivo, marcar política incoherente, conservar alerta de stock y **no emitir cantidad de compra aparentemente válida** hasta revisión.
- Con PR=0 no marcar crítico, aunque el stock sea 0. Con ventana íntegra observada y cero salidas: PR=safetyStock. Si aún no se observó la ventana completa, mostrar historial insuficiente y recomendar PR manual.
- Si un local tiene poca existencia y el depósito suficiente, eso es eventual transferencia interna, no compra externa.

**Reevaluar cuando:** se pidan guardar listas, manejar proveedores, tiempos de compra efectivos o sustituciones explícitas.

## CAND-ADR-010 — Cálculos de métricas desde movimientos, sin snapshots iniciales

**Problema.** El sistema debe informar demanda y rotación por períodos arbitrarios, sin generar datos redundantes sin necesidad.

**Selección propuesta.** Consultas/funciones calculan demanda, cantidad y días con salida, última salida y clasificación desde movimientos `EXIT`.

**Otras alternativas:**
1. Snapshots diarios por producto/ubicación: lecturas rápidas de históricos, pero jobs, cambios retroactivos y más mantenimiento.
2. Materialized views/refrescos programados: pueden mejorar agregaciones grandes, pero añaden frescura diferida y automatización innecesaria hoy.

**Criterio.** Volumen previsto modesto, fuente de datos auditable y menor complejidad operativa.

**Consecuencias.** Indexar movimientos según consultas medidas; no clasificar ajustes/entradas/saldo inicial como demanda; documentar que la clasificación por **frecuencia de días con consumo** es una *heurística operativa*, no la tasa clásica contable de rotación (`costo de ventas / inventario medio`). Calcular días civiles del reporte en la zona horaria acordada del negocio.

**Reevaluar cuando:** reportes reales sean demasiado lentos o se requiera un inventario promedio histórico preciso.

## CAND-ADR-011 — Casos de uso explícitos sin Clean Architecture ceremonial

**Problema.** Las reglas críticas requieren pruebas y separación, pero un CRUD de categoría no precisa decenas de capas.

**Selección propuesta.** Controller → servicio/caso de uso → funciones de dominio cuando aporten valor → Prisma. Distinción visible entre orquestación, reglas puras y persistencia, sin reglas universales de carpeta/clase.

**Otras alternativas:**
1. Clean Architecture con puertos/adaptadores, repositorios e interfaces para cada entidad: máxima estructura, demasiado trabajo ceremonial inicial.
2. Controllers que mezclan SQL, permisos, cálculo y respuestas HTTP: rápido al principio, acoplamiento y pruebas difíciles.

**Criterio.** Separación donde existe complejidad real, mínima abstracción donde no existe.

**Consecuencias.** Revisar especialmente `Inventory` y `Replenishment`; mantener controllers delgados y transacciones en los casos de uso.

## CAND-ADR-012 — Testing de reglas y de integración con PostgreSQL

**Problema.** Las fallas más graves se producirían en integridad/concurrencia, no en una llamada mockeada.

**Selección propuesta.** Unit tests para cálculos/reglas puras; integración/API con NestJS + DB PostgreSQL real de pruebas; pocos E2E esenciales con Playwright.

**Otras alternativas:**
1. Solo tests unitarios con mocks del ORM: veloces, no demuestran transacciones/constraints/concurrencia reales.
2. Solo E2E de navegador: verifican el sistema integrado, pero son lentos para muchos casos límite y difíciles de diagnosticar.

**Criterio.** Pirámide de pruebas ajustada al mayor riesgo del negocio.

**Consecuencias.** Migraciones en BD de tests; aislamiento/limpieza; pruebas de transacción con rollback, stock negativo, permisos y competencia por última unidad. Evitar porcentajes de cobertura arbitrarios sin baseline.

## CAND-ADR-013 — GitHub/PR y CI incremental

**Problema.** Mantener trazabilidad, evitar integración tardía y cumplir el proceso de calidad solicitado.

**Selección propuesta.** Monorepo, ramas de vida corta `feat/`, `fix/`, `docs/`, `test/`, `chore/`; Issue → PR → revisión → CI (lint/build primero, tests después) → merge.

**Otras alternativas:**
1. Trabajar directamente en `main`: menos pasos, pero menos revisión y más regresiones.
2. GitFlow con `develop`, ramas `release` y `hotfix`: útil en ciclos específicos de publicación, innecesario para este equipo y TPI.

**Criterio.** Colaboración sencilla y evidencia de cambios para E2/E3/E5.

**Consecuencias.** Definir responsables y reglas pragmáticas de PR; no fingir revisiones ni aprobación grupal inexistente.


## CAND-ADR-014 — Estructura del monorepo por aplicaciones y npm workspaces

**Problema.** El README inicial nombra `/backend` y `/frontend`, pero son convenciones provisionales previas al diseño. Buscamos una estructura clara, con dos aplicaciones ejecutables y dependencias coordinadas, sin automatización excesiva.

**Selección propuesta.** Monorepo con `/apps/api` (NestJS estándar), `/apps/web` (Angular estándar) y `/docs`, administrado con **npm workspaces** desde un `package.json` privado raíz y **un** `package-lock.json` en la raíz. No activar el modo monorepo de NestJS: solo existe una aplicación Nest.

**Otras alternativas:**
1. Conservar `/backend` y `/frontend` con instalaciones independientes: funciona, pero simplifica menos la coordinación de scripts y el lockfile; se aparta de la organización uniforme por aplicaciones acordada.
2. Adoptar Nx o Turborepo desde el inicio: caching y orquestación avanzados, pero configuración y mantenimiento adicionales que no justifican dos aplicaciones y cuatro personas.
3. Separar frontend y backend en repositorios diferentes: independencia operativa, pero dificulta cambios coordinados, revisión y documentación del TPI.

**Criterio.** KISS, experiencia real con monorepos, facilidad para CI, estructura legible y evolución sin anticipar librerías inexistentes.

**Consecuencias.** Los comandos npm se ejecutan desde raíz mediante `-w apps/api` o `-w apps/web`. No crear `/packages` ni `common` compartido hasta justificar reutilización real. La documentación y scripts deben usar rutas nuevas. El README antiguo **no es autoridad arquitectónica** y deberá actualizarse antes del primer PR de bootstrap.

**Reevaluar cuando:** haya numerosas aplicaciones/librerías, builds muy costosos o dependencias entre paquetes que ameriten orquestación con cache.

## CAND-ADR-015 — NestJS estándar ESM y Vitest como tooling inicial

**Problema.** El scaffold elegido debe alinear módulos JavaScript, testing y lint sin mantener una configuración heredada por costumbre.

**Selección propuesta.** Generar **NestJS 12 en modo estándar ESM**, usando la configuración oficial de **Vitest** para tests y **oxlint** para lint del backend; conservar **Supertest** en las pruebas HTTP/integración. Angular se genera como proyecto independiente dentro de `/apps/web`, y tendrá sus propias herramientas de test/lint según el scaffold.

**Otras alternativas:**
1. NestJS CommonJS + Jest: opción válida, especialmente si se reutilizara un backend anterior, pero aquí empezamos en blanco y ESM/Vitest coincide con el scaffold nuevo.
2. NestJS ESM + Jest configurado manualmente: se puede, pero requiere integración/configuración adicional sin una necesidad concreta.
3. Configurar Vitest y linters de ambos proyectos a mano antes de generar sus scaffolds: más trabajo y mayor riesgo de desviarse de convenciones oficiales.

**Criterio.** Seguir generadores oficiales actuales, minimizar personalizaciones iniciales y aprender tooling moderno sin perder capacidad de testear con PostgreSQL real.

**Consecuencias.** Los documentos anteriores que decían `Jest + Supertest` quedan **sustituidos** por `Vitest + Supertest` para la API. Los tests E2E web previstos continúan en Playwright. Verificar configuración real generada antes de fijar scripts de CI. No imponer a Angular oxlint por el hecho de usarlo en Nest.

**Reevaluar cuando:** el proyecto real o alguna integración muestre incompatibilidades concretas con ESM/Vitest.

**Fuentes de soporte:** [NestJS CLI](https://docs.nestjs.com/cli/overview) y [guía de migración NestJS 12](https://docs.nestjs.com/migration-guide), que documentan ESM/Vitest y CommonJS/Jest como opciones del generador.

---

## Puntos de coherencia que el equipo debe revisar antes de codificar

| Punto | Motivo | Recomendación de revisión |
|---|---|---|
| Primera carga de stock escalonada | `INITIAL_BALANCE` se puede cargar distintos días, **solo antes de cualquier otro movimiento** de ese producto en esa ubicación | Garantizar unicidad temporal/ausencia de movimientos bajo transacción; registrar usuario y momento |
| Historial suficiente para PR automático | 30 días de antigüedad del primer movimiento **no equivale** a haber observado íntegramente una ventana de 60/90 días | Preferir exigir ventana completa o calcular con días realmente observados y explicarlo; no diluir demanda artificialmente |
| Stock 0 y PR 0 | Regla `stock <= PR` marcaría crítico un producto en cero aun con seguridad cero | Validar criterio de alerta con usuario del negocio |
| Objetivo `targetStock` | En modo auto puede quedar por debajo de PR con demanda creciente | Mostrar incoherencia y acción sugerida, nunca autocorregir por sorpresa |
| Categorías hermanas | `UNIQUE(parent_id, lower(name))` en PostgreSQL no impide dos categorías raíz con `parent_id NULL` | Resolver por índices apropiados/normalización; incluir inactivas si no se reutiliza nombre |
| Bajas lógicas y stock | Un check de aplicación aislado puede competir con un nuevo ingreso | Sincronizar desactivación y movimientos con transacciones/bloqueos cuando corresponda |
| Tiempos y días | `TIMESTAMPTZ` es bueno para instantes; clasificación diaria necesita definir zona local | Agrupar días usando zona del negocio, no asumir día UTC |
| Movimientos correctivos | Un ajuste compensa saldo pero no siempre explica qué movimiento corrige | Considerar referencia a movimiento corregido si la auditoría lo requiere; no hacerlo obligatorio aún |
| Contador de puntos de función | `148 UFP` anterior fue una primera aproximación con clasificación no auditada DET/RET/FTR | No tratarlo como estimación IFPUG validada; revisar procesos elementales e índices de complejidad |

## Información que debe aportar el equipo para la bitácora oficial

Para **cada decisión realmente adoptada**:

- Decisión final del grupo, en sus palabras.
- **Al menos dos alternativas** que realmente consideraron además de la elegida (no copiar alternativas hipotéticas como si fueran deliberaciones reales).
- Criterio aplicado, evidencia o ejemplos de prueba.
- Proponente, participantes en la discusión y fecha real de adopción.
- Si hubo corrección de un consejo de IA: qué se cambió y por qué.

**Regla de integridad documental:** este archivo no prueba que hubo una deliberación. Es material para prepararla.


---

## Cierres técnicos de la revisión del 23/10/2026 (ajustados el 29/10)

Estas elecciones precisan aspectos de los 13 análisis previos, **sin atribuir una votación ni una fecha de aprobación al grupo**. Son la línea base técnica propuesta para el primer código.

| Tema | Elección recomendada | Motivo y condición |
|---|---|---|
| Runtime | **Node.js 26 LTS** (referencia local: 26.13.0) | Nueva línea base LTS para el proyecto; verificar instalación, compilación y tests antes de fijarla definitivamente. Conservar Node 24 LTS con NVM como alternativa de compatibilidad |
| Frontend | **Angular 22** y TypeScript compatible | Versión estable soportada, SPA modular por features |
| Backend | **NestJS 12.1.x+**, adapter Express | Sesiones documentadas, protección CSRF integrada y estructura modular |
| ORM | **Prisma ORM 7.10.1**, CLI y Client 7.x explícitos | Prisma 8 seguía en RC al 23/10/2026 y cambiaba el modelo de consultas; priorizar estabilidad para transacciones de stock. No instalar `prisma@latest` sin comprobar el tag: puede resolver a RC de v8 |
| ORM/Postgres | `@prisma/adapter-pg` + `pg`; migraciones versionadas | Prisma 7 requiere adaptador de driver para conexiones directas; SQL en migraciones para índices por expresión y checks que el esquema no exprese |
| Paquetes | npm workspaces con `package-lock.json` único en raíz | Equipo pequeño, dos aplicaciones y sin necesidad inicial de Nx/Turborepo |
| Carpetas | `/apps/api`, `/apps/web`, `/docs` | Estructura por aplicaciones; reemplaza la propuesta anterior `/backend` y `/frontend` del README inicial |
| Entorno | Docker Compose para `db`, `api`, `web`; desarrollo local admitido | Reproducible pero sin imponer recarga en contenedores |
| Acceso browser | Un origen `https://dominio/` y `https://dominio/api/`; en dev proxy Angular para `/api` | Evita dependencia de CORS de credenciales y facilita cookies + CSRF |
| Sessions | `express-session` + `connect-pg-simple`, `HttpOnly`, `SameSite=Lax`, `Secure` en producción | Sesiones opacas y revocables, persistidas fuera de tablas de negocio |
| CSRF | Protección integrada NestJS 12.1+ (`Sec-Fetch-Site` y `Origin`) para mutaciones, probarla; sin GET mutantes | Defiende el caso browser moderno sin inventar protocolo; revisar token CSRF si cambia compatibilidad o topología |
| Contraseñas | Argon2id; regenerar ID de sesión al login; revisar usuario activo/rol en backend | Seguridad, evitar fijación de sesión y permisos obsoletos |
| Categorías | `UNIQUE INDEX` SQL sobre `(parent_id, lower(btrim(name))) NULLS NOT DISTINCT` en PostgreSQL >=15 | Evita duplicados sin padre y por mayúsculas/espacios; mantener reservados nombres de inactivas |
| Saldo inicial | Se permite cualquier fecha, solo si **nunca hubo movimiento** del producto en esa ubicación | Inserción exclusiva inicial de saldo; nunca borrar filas de saldo en cero tras operaciones para conservar el testigo de primera operación |
| Concurrencia | Primer `INITIAL_BALANCE` compite vía inserción `stock_balance` con PK única y transacción; las entradas usan upsert atómico | No alcanza consultar `findFirst` antes de crear; la restricción única serializa operaciones rivales |
| Stock y desactivación | Bloquear filas `Product`/`Location` al validar status y ejecutar movimiento/desactivación; orden de locks estable | Evita carrera entre inactivar producto sin stock e ingresar nuevas unidades al mismo tiempo |
| Tiempo | UTC para instantes y **`America/Argentina/Cordoba`** para agrupar días civiles de reportes | Separar almacenamiento de interpretación de calendario |
| Historial reposición | PR automático solo con ventana completa observada desde primer movimiento; si no, estado `INSUFFICIENT_HISTORY` y opción manual | No dividir pocas ventas entre 60/90 días sin datos registrados durante toda esa ventana; el negocio debe registrar salidas desde que comienza la observación |
| Stock cero y PR cero | **No generar alerta de reposición si PR=0** | Evita alertas triviales para productos sin demanda y safety stock 0; quien quiera alertar configura PR positivo |
| Política incoherente | Mantener señal de necesidad y mostrar `POLICY_REVIEW_REQUIRED`, sugerencia de cantidad `null` | No ocultar riesgo ni proponer `0` unidades con falsa confianza |
| Rotación | Clasificación inicial por frecuencia de **días con EXIT**, no la rotación contable | Heurística simple sujeta a evaluación real |
| API | `page/pageSize` (20/100); errores `{code,message,details?,requestId?}` | Contratos consistentes, sin filtrar información interna |
| QA | **Vitest (API ESM)** + Supertest + PostgreSQL de pruebas + algunos Playwright | Scaffold oficial NestJS 12 ESM, tests de integración reales y flujos críticos |
| Redis | **Futuro**: session store → cache medida → BullMQ | Objetivo de aprendizaje posterior, no dependencia de v1 |

### Salvaguardas y compromisos no negociables

- Los cambios de stock siguen un único mecanismo de aplicación: cambio de saldo y registro de movimiento en la **misma transacción**.
- No usar `db push` en reemplazo de migraciones versionadas para la entrega; SQL manual y Prisma schema deben reconciliarse con pruebas de migración.
- Para la carga inicial, una cantidad 0 no necesita movimiento; ausencia de saldo equivale a cero hasta la primera operación. Si ya hubo cualquier movimiento, una discrepancia posterior se registra como ajuste.
- Evitar que una caída de la consulta de usuario activo/rol autorice por error una sesión antigua; si no puede verificarse, rechazar.
- El valor **148 UFP anterior es un ejercicio preliminar**, no un conteo IFPUG validado por DET/FTR/RET; no usarlo todavía como estimación formal.
- El README actual todavía describe **cinco integrantes** y transferencias como funcionalidad principal; debe reconciliarse con el equipo real de cuatro y el backlog P1. Falta identificar qué nombre retirar, no adivinarlo.

### Referencias técnicas verificadas (23/10/2026; scaffold revisado el 29/10/2026)

- NestJS (sesiones): https://docs.nestjs.com/techniques/session
- NestJS (CSRF nativo desde v12.1): https://docs.nestjs.com/security/csrf
- Angular seguridad/XSRF: https://angular.dev/best-practices/security
- Prisma 7/PostgreSQL: https://www.prisma.io/docs/v7/prisma-orm/quickstart/postgresql
- Prisma estado de versiones: https://www.prisma.io/docs/orm/release-status
- Node.js soporte: https://nodejs.org/en/about/previous-releases


## Cambio de línea base — 29/10/2026

**Sustituye específicamente** la elección anterior de carpetas y testing del scaffold: `/backend` → `/apps/api`; `/frontend` → `/apps/web`; **Jest → Vitest** para nuevos proyectos NestJS ESM. Se mantienen las demás decisiones del dominio, PostgreSQL/Prisma, sesiones y backlog técnico de Redis.

- **Script raíz y dependencias:** npm workspaces; scripts raíz delegan con `npm run <script> -w apps/api` y `-w apps/web`. `npm install` en la raíz después de generar los proyectos con `--skip-install`.
- **Inicialización:** CLI NestJS *standard* en `apps/api`, modo ESM; CLI Angular en `apps/web`; ambos sin subrepositorios Git.
- **No agregar por inercia** `packages/`, Nx, Turborepo, NestJS monorepo mode ni un conjunto vacío de módulos.
- La estructura sustituye lo escrito en el README antiguo. La documentación del proyecto debe sincronizarse en el primer PR; **el repositorio remoto no se ha modificado** en esta revisión.


## Cambio de línea base — 29/10/2026 (v4: runtime Node.js)

**Elección de versión de runtime:** Node.js **26 LTS**, versión objetivo inicial **26.13.0**, con npm de la instalación de Node. Se conserva Node.js **24 LTS** en NVM como plan de reversión si se detecta una incompatibilidad real durante el bootstrap.

**Alternativas examinadas:** (1) mantener Node 24 LTS, ya instalado y probado; (2) permanecer en Node 22, pero la versión local original 22.14.0 era inferior al mínimo requerido para Angular 22; (3) adoptar Node 26 LTS, elegido para comenzar en una rama LTS más nueva sin migrar código existente.

**Criterio:** soporte a largo plazo y ausencia de código generado todavía. La adopción queda condicionada a verificar las versiones de Angular/NestJS/Prisma elegidas mediante instalación, `build` y pruebas; no se deduce compatibilidad solamente de que Node 26 sea LTS.

**Impacto:** actualizar `docs/setup.md` y el README; no modifica estructura del monorepo, módulos, esquema relacional, reglas de negocio, ni la elección de Angular 22 / NestJS 12 / Prisma 7. Registrar en el PR la versión de Node efectivamente usada por el equipo.
