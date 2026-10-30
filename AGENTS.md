# Guía para agentes de código — Inventario PyME (TPI ICSW 2026)

## Contexto y fuentes de verdad

- Proyecto académico de Ingeniería y Calidad de Software: aplicación web de inventario para una PyME de insumos informáticos y reparaciones.
- Antes de implementar, leer `README.md` y los documentos de `docs/`, particularmente `arquitectura.md`, `analisis_decisiones_arquitectonicas_v4.md`, `registro_decisiones_menores_v4.md` y, cuando existan, `requisitos.md` y `backlog.md`.
- Si dos documentos se contradicen o una decisión necesaria no está resuelta, identificar el conflicto y proponer la resolución antes de implementarla. No asumir que un bosquejo preliminar es una especificación inmutable.
- No modificar ni inventar la bitácora cronológica del equipo (`docs/decisiones.md`) sin que sus integrantes revisen fechas, participantes y conclusiones.

## Stack y organización

- Node.js 26 LTS; monorepo npm workspaces con `apps/api` (NestJS 12, TypeScript, ESM, Vitest) y `apps/web` (Angular 22, TypeScript, Vitest); PostgreSQL; Prisma 7 estable. Mantener un solo `package-lock.json` en la raíz.
- Backend monolito modular: Identity, Catalog, Inventory, Replenishment y Reporting. Frontend por features. Respetar la arquitectura existente; evitar capas o patrones genéricos sin beneficio demostrado.
- Mantener `/api` como prefijo/contrato HTTP y documentar endpoints con OpenAPI conforme se implementen.
- No introducir microservicios, CQRS, Event Bus, NgRx, Redis, BullMQ, JWT, gestión de compras ni integraciones externas en la primera versión sin autorización expresa. Redis es una evolución futura de aprendizaje, no dependencia de v1.

## Reglas del dominio que deben preservarse

- Dos roles iniciales: ADMIN y OPERATOR; autorización efectiva en el backend.
- Productos con estados ACTIVE, DISCONTINUED, INACTIVE; `DISCONTINUED` permite agotar stock pero no genera reposición automática. No inactivar productos ni ubicaciones con stock remanente.
- Stock actual por par producto/ubicación y movimientos históricos inmutables desde la aplicación. Toda modificación de stock debe crear movimiento y actualizar saldo en **una única transacción**.
- No permitir stock negativo: salidas y ajustes negativos requieren actualización condicional atómica y pruebas de concurrencia. Proteger también creación concurrente del primer saldo.
- `INITIAL_BALANCE` puede registrarse en cualquier fecha durante carga gradual, pero únicamente como **primer movimiento** de cada combinación producto/ubicación, incluso frente a concurrencia.
- Los ajustes requieren motivo y se registran como delta, sin reescribir saldos o movimientos anteriores.
- Reposición inicial por SKU y stock global (suma de ubicaciones), con política manual/automática y cálculo explicable; no automatizar compras ni persistir listas/sugerencias sin requerimiento.
- Rotación y demanda calculadas desde salidas de consumo, no desde entradas, ajustes o saldos iniciales. Manejar zona horaria del negocio al agrupar días.

## Seguridad y calidad

- Sesión de servidor + cookie HttpOnly y atributos seguros; almacenamiento inicial de sesiones en PostgreSQL. Contraseñas con Argon2id. Contemplar CSRF para operaciones mutantes y el despliegue bajo mismo origen.
- Validar entradas, aplicar restricciones en PostgreSQL donde corresponda, no revelar secretos ni errores internos al cliente. Nunca commitear `.env`, contraseñas o tokens.
- Pruebas unitarias para reglas, integración contra PostgreSQL de prueba para transacciones/concurrencia, pocos E2E para flujos críticos. Ejecutar build, lint y pruebas relevantes.
- No falsear cobertura, logs, resultados de tests ni evidencia de ejecución. Documentar limitaciones cuando el entorno impida verificar algo.

## Forma de trabajar

- Implementar por hitos pequeños y revisables: (1) bootstrap/workspaces/health/CI, (2) DB y migraciones, (3) identidad, (4) catálogo, (5) inventario, (6) reposición y rotación, (7) UI y E2E.
- Para cada hito: explicar plan breve, limitar el alcance, modificar código, ejecutar validaciones, indicar archivos cambiados y posibles riesgos. No avanzar al siguiente hito sin revisión del responsable del proyecto.
- No cambiar versiones mayores, arquitectura, alcance ni invariantes sin explicar alternativas y solicitar validación.
- Preferir código legible, sencillo y coherente con el dominio a abstracciones innecesarias.
