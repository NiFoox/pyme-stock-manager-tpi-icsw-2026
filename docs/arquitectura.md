# Arquitectura — Inventario PyME v1

**Runtime de desarrollo:** Node.js **26 LTS** (26.13.0 objetivo); Node 24 LTS como alternativa de compatibilidad.

**Estado:** bootstrap e INFRA-01 integrados mediante PR #3 y #4. PostgreSQL 18 en Compose, Prisma 7.10.1 y CI configurados; resultados previos en [verificación](infra-01-verificacion.md). US-01 implementa Identity y sesiones; el resto de los módulos de dominio está pendiente.

US-01 incorpora Identity, sesiones PostgreSQL y UI mínima, pendiente de revisión;
ver [configuración y decisiones de autenticación](us-01-autenticacion.md).

## Objetivo y alcance

Sistema web monolítico modular para PyME de insumos informáticos y reparaciones. P0: usuarios/roles, catálogo, ubicaciones, existencias y movimientos, historial, punto de reposición y reporte de rotación. No ERP.

## Componentes

```text
Angular 22 SPA  ── HTTP JSON /api ──> NestJS 12+ (Express)
                                          │
                       ┌──────────────────┼─────────────────┐
                    Identity           Catalog           Inventory
                                                               │
                                                       Replenishment/Reporting
                                          │
                                      Prisma 7
                                          │
                                     PostgreSQL
                                  (dominio + sesiones)
```

Mismo origen en producción mediante reverse proxy; en desarrollo proxy Angular `/api`. Cookie de sesión HttpOnly/Secure/SameSite=Lax; CSRF nativo de Nest; rol efectivo consultado en backend.

## Organización del repositorio y herramientas

```text
raíz (npm workspaces, package-lock.json único)
├── apps/
│   ├── api/    (NestJS 12 estándar, ESM, Vitest, oxlint, Supertest)
│   └── web/    (Angular 22, features, routing, tooling propio)
├── docs/       (análisis, especificaciones y guía de setup)
└── .github/    (CI de ambas apps)
```

La estructura reemplaza la nomenclatura provisional `/backend` y `/frontend` del README inicial. No se usa NestJS monorepo mode, Nx ni Turborepo. No existe `/packages` inicialmente; se agrega únicamente ante código compartido que lo justifique (ej. cliente API generado desde OpenAPI).

La API NestJS divide funciones en `Identity`, `Catalog`, `Inventory`, `Replenishment` y `Reporting`; este último calcula métricas sin tablas propias. La organización por módulo no exige capas ceremoniales para los CRUD simples.

En INFRA-01 solo existen infraestructura de base de datos y health; no se crean
módulos de dominio vacíos. API y web se ejecutan en el host, con PostgreSQL en
Compose y una instancia efímera de pruebas separada. Prisma usa cliente ESM
generado dentro de las fuentes, compilado con NodeNext. `GET /api/health` comprueba
HTTP; un diagnóstico independiente comprueba consultas a PostgreSQL. No hay
conexión obligatoria ni migraciones automáticas al arrancar HTTP.

## Dominio previsto (pendiente de implementación)

7 tablas: `users`, `categories`, `products`, `locations`, `stock_balances`, `inventory_movements`, `replenishment_policies`. Almacenamiento de sesión es infraestructura aparte. Métricas/sugerencias se calculan desde saldo, movimientos y política; no tienen entidad propia.

`stock_balances(product_id, location_id)` tiene unicidad, `quantity>=0`; cada cambio de saldo está asociado a un movimiento inmutable y a una transacción. No hay event sourcing, ni snapshots/jóbs iniciales.

## Pruebas y CI

- API: **Vitest** (unitarias) y **Vitest + Supertest** (pruebas HTTP), con PostgreSQL de prueba para integridad y concurrencia.
- Web: conservar configuración de tests del scaffold Angular y agregar **Playwright** para flujos E2E críticos cuando aparezcan.
- CI: instalación reproducible con `npm ci` desde raíz, build/lint y pruebas progresivas de ambas apps, sin inventar scripts inexistentes.

## Dependencias y evolución

La dependencia natural de desarrollo es identidad/catálogo/ubicaciones → stock+ledger → reposición → rotación. Transferencias son P1; Redis como session store, cache y BullMQ son ejercicios futuros, al igual que JWT y módulos ERP.

## Documentos relacionados

- [Análisis arquitectónico y alternativas](analisis_decisiones_arquitectonicas_v4.md)
- [Registro técnico menor](registro_decisiones_menores_v4.md)
- [Guía de setup](setup.md)
