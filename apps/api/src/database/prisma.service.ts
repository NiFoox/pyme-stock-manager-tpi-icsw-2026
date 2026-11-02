import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { loadEnvironment, readEnvironment } from '../config/environment.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    loadEnvironment();
    const environment = readEnvironment();
    super({
      adapter: new PrismaPg({
        connectionString: environment.databaseUrl,
        connectionTimeoutMillis: 5_000,
        max: 5,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
