import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 7 убрала Rust-движок: рантайм-подключение требует драйвер-адаптера,
 * а `datasourceUrl` и вызов конструктора без аргументов больше не работают.
 * Пул соединений теперь наш, поэтому его надо и закрывать — незакрытый пул
 * оставляет процесс Jest висеть после прогона тестов.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    // Пул создаётся до super() и запоминается после: обращаться к this раньше
    // вызова super нельзя.
    const pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });

    super({ adapter: new PrismaPg(pool) });

    this.pool = pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
