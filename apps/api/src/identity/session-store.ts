import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { readEnvironment } from '../config/environment.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

@Injectable()
export class SessionStore implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: readEnvironment().databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 5,
  });
  readonly store = new (connectPgSimple(session))({
    pool: this.pool,
    tableName: 'sessions',
    createTableIfMissing: false,
    disableTouch: true,
    errorLog: () =>
      console.error('No se pudo acceder al almacenamiento de sesiones.'),
  });

  constructor() {
    this.pool.on('error', () =>
      console.error('Conexión de sesiones no disponible.'),
    );
  }

  async onModuleDestroy() {
    // connect-pg-simple 10 returns a Promise; its DefinitelyTyped signature is void.
    await Promise.resolve(this.store.close());
    await this.pool.end();
  }
}
