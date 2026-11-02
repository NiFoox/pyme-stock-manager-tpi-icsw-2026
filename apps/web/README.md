# Web — Inventario PyME

Angular 22 standalone, TypeScript, SCSS, Angular ESLint y Vitest.
Instalar desde la raíz con npm ci; mantener un solo lockfile.

~~~
npm run dev:web
npm run build:web
npm run lint:web
npm run test:web
~~~

El servidor de desarrollo atiende en http://localhost:4200 y reenvía /api/**
a http://127.0.0.1:3000, conservando el prefijo. Si cambia el puerto HTTP de la API,
actualizar [proxy.conf.json](proxy.conf.json). El proxy no forma parte del build
de producción: el despliegue futuro deberá servir web y /api bajo el mismo origen.

Ver la [guía de setup](../../docs/setup.md). INFRA-01 conserva la interfaz del
scaffold; los flujos funcionales y Playwright corresponden a hitos posteriores.
