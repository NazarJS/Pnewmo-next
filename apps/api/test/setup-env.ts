import { config } from 'dotenv';

/**
 * globalSetup для e2e: подменяет DATABASE_URL на адрес тестовой базы до того,
 * как PrismaService соберёт пул соединений. Без этого тесты работали бы по
 * dev-базе и затирали её данные — а TRUNCATE в beforeEach сделал бы это
 * незаметно.
 */
export default function globalSetup(): void {
  config();

  const testUrl = process.env.DATABASE_URL_TEST;

  if (!testUrl) {
    throw new Error('DATABASE_URL_TEST не задан. Выполните: pnpm db:test:setup');
  }

  process.env.DATABASE_URL = testUrl;
}
