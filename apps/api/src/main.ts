import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnvironment, readEnvironment } from './config/environment.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  loadEnvironment();
  const environment = readEnvironment();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(environment.port);
}
try {
  await bootstrap();
} catch {
  console.error(
    'No se pudo iniciar la API. Revisar configuracion del entorno.',
  );
  process.exitCode = 1;
}
