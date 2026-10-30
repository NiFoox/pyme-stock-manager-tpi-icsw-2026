# Inventario para PyME

Aplicación web para la gestión de inventario de una PyME dedicada a la venta de insumos informáticos y reparación de equipos, con foco en la confiabilidad del stock, la trazabilidad de movimientos y la reposición informada.

Proyecto desarrollado como Trabajo Práctico Integrador de **Ingeniería y Calidad de Software — UTN FRVT, 2026**.

> **Estado:** bootstrap técnico generado y verificado localmente. Angular y NestJS compilan, superan las comprobaciones iniciales de lint y testing, y arrancan en modo desarrollo. La integración con PostgreSQL, Prisma, CI y las funcionalidades de negocio están pendientes.

## Alcance del proyecto

### Versión inicial (P0)

- Autenticación y autorización con roles `ADMIN` y `OPERATOR`.
- Gestión de productos y categorías jerárquicas.
- Gestión de ubicaciones físicas: local y depósito.
- Consulta de stock por producto y ubicación.
- Registro gradual de saldos iniciales.
- Entradas, salidas y ajustes de stock con trazabilidad.
- Historial de movimientos y consistencia transaccional.
- Políticas de reposición manual y automática.
- Identificación de productos críticos y sugerencias de reposición.
- Reportes de consumo, frecuencia y rotación.

### Funcionalidades posteriores (P1)

- Transferencias internas entre ubicaciones.
- Indicadores de cobertura de stock.
- Reportes agregados por categorías y otros criterios.

### Posibles ampliaciones futuras

Como oportunidades de aprendizaje, se contempla evaluar Redis para almacenamiento de sesiones o caché, BullMQ para procesamiento de tareas y otras alternativas arquitectónicas cuando exista una necesidad concreta.

**Fuera del alcance:** facturación, caja, contabilidad, presupuestos, pagos, gestión completa de compras y reemplazo del sistema administrativo existente. La aplicación no realizará compras automáticamente.

## Arquitectura y tecnologías

El proyecto utiliza un **monorepo con npm workspaces** sobre Node.js 26 LTS, organizado en dos aplicaciones independientes.

### Tecnologías configuradas

| Componente | Tecnología |
|---|---|
| Runtime | Node.js 26 LTS |
| Gestor de paquetes | npm 11 |
| Frontend | Angular 22, TypeScript, SCSS |
| Backend | NestJS 12, TypeScript, ESM |
| Testing backend | Vitest, Supertest |
| Testing frontend | Vitest |
| Análisis estático backend | oxlint |
| Análisis estático frontend | Angular ESLint |
| Control de versiones | Git y GitHub |
| Gestión del proyecto | GitHub Issues y GitHub Projects |

### Tecnologías previstas

| Componente | Tecnología |
|---|---|
| Base de datos | PostgreSQL 18 |
| ORM y migraciones | Prisma 7 |
| Contenedores | Docker Compose |
| Integración continua | GitHub Actions |
| Pruebas E2E | Playwright |

La arquitectura prevista es un **monolito modular**, con API REST y organización por funcionalidades.

Se priorizan la separación de responsabilidades, la mantenibilidad, la seguridad, la trazabilidad y las pruebas automatizadas, evitando introducir patrones o infraestructura sin una necesidad justificada.

Las decisiones y alternativas consideradas se encuentran documentadas en `docs/`.

## Estructura del repositorio

```text
pyme-stock-manager-tpi-icsw-2026/
├── apps/
│   ├── api/               # Backend NestJS
│   └── web/               # Frontend Angular
├── docs/                  # Documentación técnica y decisiones
├── AGENTS.md              # Instrucciones generales para agentes de código
├── .gitignore
├── package.json           # Configuración de npm workspaces
├── package-lock.json      # Dependencias bloqueadas del monorepo
└── README.md
```

El backend puede contener un `AGENTS.md` adicional con instrucciones específicas.

No se incorporarán directorios compartidos como `packages/` ni herramientas de orquestación adicionales hasta que exista una necesidad concreta.

## Requisitos

Para ejecutar el bootstrap actual:

- Node.js 26 LTS.
- npm compatible con Node.js 26.
- Git.

Para las próximas etapas de desarrollo también se utilizará Docker Desktop con Docker Compose.

Se recomienda utilizar NVM para administrar las versiones de Node.js.

## Instalación

Clonar el repositorio:

```bash
git clone https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026.git
cd pyme-stock-manager-tpi-icsw-2026
```

Instalar las dependencias desde la raíz:

```bash
npm ci
```

El monorepo utiliza un único `package-lock.json` en la raíz, por lo que no es necesario instalar las dependencias por separado en cada aplicación.

En Windows, los comandos pueden ejecutarse desde CMD. Si PowerShell bloquea `npm.ps1`, es posible utilizar `npm.cmd`.

## Ejecución en desarrollo

El frontend y el backend deben ejecutarse en terminales independientes.

### Backend

```bash
npm run dev:api
```

La aplicación NestJS estará disponible en:

`http://localhost:3000`

Actualmente, el endpoint inicial devuelve `Hello World!`. Será reemplazado o adaptado cuando incorporemos la API funcional y el endpoint de salud.

### Frontend

```bash
npm run dev:web
```

La aplicación Angular estará disponible en:

`http://localhost:4200`

Ambos servidores utilizan modo de desarrollo con detección de cambios.

## Calidad y pruebas

Los siguientes comandos se ejecutan desde la raíz del repositorio.

### Compilación

```bash
npm run build
```

Para compilar cada aplicación individualmente:

```bash
npm run build:api
npm run build:web
```

### Análisis estático

```bash
npm run lint
```

También pueden ejecutarse por separado:

```bash
npm run lint:api
npm run lint:web
```

### Testing

```bash
npm run test:api
npm run test:web
```

### Auditoría de dependencias

```bash
npm audit
```

Durante el bootstrap inicial se verificaron satisfactoriamente las compilaciones, el análisis estático y los tests generados por las herramientas. La auditoría de dependencias finalizó sin vulnerabilidades conocidas en ese momento.

Estas comprobaciones todavía no representan una validación de las funcionalidades del inventario. Se incorporarán pruebas unitarias, de integración y E2E conforme avance su implementación.

## Gestión del proyecto

La planificación y el seguimiento del desarrollo se realizan mediante **GitHub Issues y GitHub Projects**, utilizando un flujo de trabajo ágil basado en Kanban e iteraciones.

Estados del tablero:

1. **Backlog:** trabajo identificado y pendiente de preparación.
2. **Ready:** trabajo refinado y listo para comenzar.
3. **In Progress:** trabajo en desarrollo.
4. **In Review:** implementación o documentación pendiente de revisión.
5. **Done:** trabajo completado y validado.

Cada funcionalidad o tarea técnica se registra como un Issue con su alcance, criterios de aceptación y prioridad.

Las estimaciones mediante Story Points se incorporarán a partir del proceso de estimación grupal.

### Flujo de contribución

- Seleccionar y asignar un Issue.
- Crear una rama específica desde `main`.
- Implementar los cambios correspondientes.
- Ejecutar las verificaciones pertinentes.
- Abrir un Pull Request vinculado al Issue.
- Revisar el código y comprobar los criterios de aceptación.
- Fusionar el PR cuando se cumpla la Definition of Done.

Los Pull Requests pueden utilizar `Closes #n` para cerrar automáticamente el Issue correspondiente al fusionarse con `main`.

El desarrollo puede apoyarse en asistentes de programación como Codex, manteniendo la revisión humana, la trazabilidad de las decisiones y la validación de los resultados.

## Documentación

La documentación técnica y metodológica se mantiene en el directorio `docs/`.

- [Arquitectura del sistema](docs/arquitectura.md)
- [Análisis de decisiones arquitectónicas](docs/analisis_decisiones_arquitectonicas_v4.md)
- [Registro de decisiones técnicas menores](docs/registro_decisiones_menores_v4.md)
- [Guía de instalación y configuración](docs/setup.md)

El archivo [AGENTS.md](AGENTS.md) contiene instrucciones generales para los agentes de programación que colaboren en el repositorio.

## Próximos pasos

- Completar la revisión y el Pull Request del bootstrap.
- Configurar PostgreSQL mediante Docker Compose.
- Integrar Prisma y preparar las migraciones.
- Incorporar configuración de entorno y un endpoint de salud.
- Configurar GitHub Actions para las verificaciones automatizadas.
- Implementar progresivamente las funcionalidades P0 de acuerdo con el Product Backlog.

## Equipo

- Donato Cacchiarelli
- Tomás Acosta
- Iván Salomón
- Wilfer Florentín