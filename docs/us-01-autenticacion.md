# US-01 — Inicio y cierre de sesión

Implementación del [Issue #5](https://github.com/NiFoox/pyme-stock-manager-tpi-icsw-2026/issues/5).
No incluye registro público, ABMC de usuarios ni funcionalidades de otras historias.

## Decisiones de implementación

- Identity agrupa autenticación y sesiones. NestJS instalado: 12.3.2; Node: 26.13.0.
  No se cambian versiones mayores ni arquitectura.
- Usuario canónico: `trim().toLowerCase()`, 3–64 caracteres ASCII (`a-z`, `0-9`, `.`, `_`, `-`),
  empezando por letra o número. PostgreSQL exige ese formato con CHECK y unicidad con UNIQUE.
  No depende de la collation ni permite variantes de mayúsculas en escrituras directas.
- PK BIGINT identity, expuesta como string decimal en JSON para evitar pérdida de precisión.
  Instantes TIMESTAMPTZ. Contraseña Argon2id (64 MiB, 3 iteraciones, paralelismo 1).
- Sesión opaca de express-session, persistida en PostgreSQL con connect-pg-simple.
  Solo guarda `userId` y metadatos de cookie. `/auth/me` consulta estado y rol actuales.
  No hay fallback en memoria si falla PostgreSQL; responde 503 sin conceder acceso.
  El middleware se aplica a `/api`, exceptuando `/api/health` (también con cookie).
  Para proteger rutas de otros módulos, importar IdentityModule y aplicar
  `@UseGuards(SessionAuthGuard)`: valida sesión y usuario activo y expone en
  `request.user` los datos públicos y el rol consultados en esa solicitud.
  Montar el middleware no convierte automáticamente una ruta en protegida.
- Duración absoluta inicial de 8 horas, sin renovación por lecturas (`rolling: false`,
  `disableTouch: true`). Al login se destruye el id anterior mediante regeneración y se
  espera la persistencia; logout espera la destrucción y limpia la cookie.
- Cookie `pyme.sid`, Path `/api`, HttpOnly, SameSite=Lax, sin Domain. Secure siempre en
  producción; en desarrollo/test se activa automáticamente al detectar HTTPS.
- Respuestas de autenticación sin caché (`Cache-Control: no-store`). Errores uniformes
  `{code,message}`, sin hashes, SQL, stack, secretos ni identificadores de sesión en JSON.
  401 corresponde a identidad no válida; 403 a solicitud rechazada por CSRF.
  El filtro conserva errores HTTP conocidos, usa 503 solo para fallos identificados
  de conectividad/pool/PostgreSQL y 500 para errores inesperados. El diagnóstico
  interno registra categorías y códigos permitidos, sin mensajes originales,
  metadatos, SQL, credenciales ni stacks.
- Límite básico: 10 intentos de login por IP y minuto, incluyendo intentos correctos,
  previo al hash y acceso a usuarios. Mapa acotado a 10.000 IP; 429 al alcanzar límites.
  Es local al proceso y se reinicia al reiniciar la API. Para varias instancias habrá
  que revisar esta protección; no se incorpora infraestructura distribuida en v1.
  Se cuentan los éxitos porque también consumen verificación Argon2id; una cuenta
  conocida no permite reiniciar el límite. Varias personas detrás de NAT comparten
  cupo, por lo que más de diez logins legítimos en un minuto también producen 429.
  La IP proviene de Express (`req.ip`): con TRUST_PROXY_HOPS=0 no se confía en
  X-Forwarded-For; con proxies, el valor solo es fiable si se restringe el acceso
  directo y se reemplazan los headers reenviados. Mantener el límite es una decisión
  del MVP, no una defensa distribuida ni contra ataques desde muchas IP.

La documentación de infraestructura describe una etapa anterior sin modelos ni sesiones.
US-01 incorpora el primer modelo real y su migración, conservando health sin dependencia
de SQL. Los documentos arquitectónicos recomiendan el mecanismo elegido y el pedido actual
autoriza expresamente la interfaz mínima y sus pruebas dentro de esta historia. No hay
cambio de invariantes ni se atribuyen deliberaciones al equipo.

## Configuración

En el entorno de API (archivo local no versionado o variables del proceso):

| Variable | Configuración |
|---|---|
| `DATABASE_URL` | PostgreSQL de desarrollo/producción |
| `TEST_DATABASE_URL` | PostgreSQL separado, nombre terminado en `_test` |
| `SESSION_SECRET` | Obligatorio al iniciar HTTP: hexadecimal aleatorio de al menos 32 bytes |
| `SESSION_TTL_SECONDS` | 28800 por defecto; entero de 60 a 604800 |
| `TRUST_PROXY_HOPS` | 0 por defecto; 0–10, configurar solo para proxies confiables |
| `NODE_ENV` | `production` exige cookie Secure y HTTPS |

Generar el secreto **localmente**, sin publicarlo ni reutilizarlo como contraseña:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Rotar el secreto invalida las cookies existentes. No hay secreto predeterminado.
La validación exige formato/longitud y descarta repeticiones triviales; la aleatoriedad
debe provenir del generador criptográfico, no puede probarse a partir de una cadena.
El diagnóstico de BD y la generación/migración Prisma no necesitan SESSION_SECRET.

## Migraciones y primer administrador

Desde la raíz, con DATABASE_URL apuntando al destino correcto:

```sh
npm run prisma:migrate:deploy
npm run build:api
```

La migración [20261104000000_identity](../apps/api/prisma/migrations/20261104000000_identity/migration.sql)
crea `users`, el enum de roles y `sessions` con índice por expiración. Las sesiones son
infraestructura de connect-pg-simple; Prisma representa su estructura con `@@ignore`
para preservar la tabla en futuras migraciones, sin generar acceso desde Prisma Client.
El store no crea tablas al arrancar.
No usar db push, resets ni borrar volúmenes. La API no migra automáticamente.

Para aprovisionar, proporcionar nombre de usuario por argumento y contraseña de 12–128
caracteres por **stdin redirigido** desde un archivo privado fuera del repositorio o un
gestor de secretos. El comando rechaza entrada interactiva para evitar eco en terminal.
No escribir la contraseña en argumentos, variables versionadas ni historial del shell.

Ejemplo en CMD, desde la raíz (sustituir usuario y ruta del archivo privado):

```bat
npm run auth:create-admin -- nombre.admin < C:\ruta-privada\password.txt
```

En PowerShell usar `Get-Content -Raw -LiteralPath 'C:\ruta-privada\password.txt' | npm.cmd run auth:create-admin -- nombre.admin`.
El archivo debe contener solo la contraseña, con un salto de línea final opcional, sin BOM.
Proteger y eliminar ese archivo según el procedimiento local de gestión de secretos.
La CLI no muestra la contraseña ni datos de conexión. Crea exclusivamente el primer
usuario ADMIN activo, bajo bloqueo transaccional de tabla. Si ya existe **cualquier**
usuario, rechaza la operación; llamadas concurrentes no crean dos administradores.
No sobrescribe cuentas. Recuperación administrativa posterior requiere procedimiento
del responsable del despliegue; no se agrega una puerta de recuperación HTTP en US-01.

## HTTP y navegador

Ver el [contrato OpenAPI](openapi.yaml):

- `POST /api/auth/login` con `{username,password}` → 200 con `{id,username,role}`.
  Credenciales inválidas, usuario ausente o inactivo → mismo 401. DTO inválido → 400.
- `GET /api/auth/me` → 200 con usuario vigente, 401 sin sesión vigente/usuario activo.
- `POST /api/auth/logout` → 204, incluso sin sesión. Si no se pudo invalidar por fallo
  de BD devuelve error: la UI no afirma que la sesión terminó.
- `GET /api/health` sigue público y responde 200 sin conexión SQL.

Angular usa HttpClient con rutas relativas `/api` y cookies del navegador. `/` es una
vista mínima de sesión protegida; al entrar/recargar consulta `/auth/me`. Sin sesión
redirige a `/login`; con fallo de servicio muestra un mensaje genérico. No guarda
credenciales ni el identificador de sesión en localStorage o JavaScript.

## CSRF y despliegue

Se verificó la [documentación oficial de NestJS](https://docs.nestjs.com/security/csrf)
y su [fuente](https://github.com/nestjs/docs.nestjs.com/blob/master/content/security/csrf.md).
`app.enableCsrfProtection()` se registra antes del middleware de sesiones, sin excepciones
ni orígenes de confianza. Rechaza mutaciones `cross-site` y `same-site` con 403; sin
Fetch Metadata exige que Origin coincida con Host. Clientes no navegador sin ambos
headers son admitidos según el mecanismo nativo. No hay rutas GET mutantes de negocio.

En desarrollo se conserva el [proxy Angular](../apps/web/proxy.conf.json); no habilitar
CORS con credenciales. En producción servir SPA y `/api` bajo el mismo origen, con HTTPS.
El reverse proxy debe preservar Host, reemplazar headers reenviados y restringir el
acceso directo a la API. Configurar TRUST_PROXY_HOPS según esa topología, nunca confiar
en headers de un cliente directo. Sin Fetch Metadata, la comparación Origin/Host no
conoce el esquema; el proxy HTTPS debe aplicar HSTS. Navegadores antiguos sin ninguno
de los dos headers requerirían evaluar tokens CSRF adicionales (fuera de esta entrega).

## Verificación

```sh
npm run db:test:up
npm run prisma:migrate:test
npm run build
npm run lint
npm run test:api
npm run test:api:e2e
npm run test:api:integration
npm run test:web
npm run test:api:runtime
```

El comando de migración de pruebas valida separación de base antes de ejecutar deploy;
CI lo ejecuta antes de integración. No migra desarrollo como efecto de las pruebas.
Las suites generan secretos y contraseñas efímeros, no cuentas predeterminadas.
Las pruebas HTTP de autenticación usan PostgreSQL real; las pruebas Angular ejercitan
servicio, componentes y navegación con HttpTestingController. No equivalen a una prueba
Playwright en navegador completo ni a ejecutar CI remoto.
