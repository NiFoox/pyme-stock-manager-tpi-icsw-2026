# Arquitectura — Inventario PyME v1

**Runtime de desarrollo:** Node.js **26 LTS** (26.13.0 objetivo); Node 24 LTS como alternativa de compatibilidad.

**Estado (30/10/2026):** monorepo Angular + NestJS generado y validado (build, lint, tests iniciales y arranque); base de datos y funcionalidades pendientes.

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

## Dominio persistido

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
