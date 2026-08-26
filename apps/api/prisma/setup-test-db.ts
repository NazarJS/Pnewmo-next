import 'dotenv/config';
import { Client } from 'pg';

/**
 * Создаёт базу под e2e-тесты. Идемпотентно: повторный запуск ничего не портит.
 * Отдельная база нужна, чтобы прогон тестов не затирал сиды в dev-базе и не
 * делал результаты зависимыми от порядка тестов.
 */
async function main(): Promise<void> {
  const testUrl = process.env.DATABASE_URL_TEST;

  if (!testUrl) {
    throw new Error('DATABASE_URL_TEST не задан в apps/api/.env');
  }

  const adminUrl = process.env.DATABASE_URL;

  if (!adminUrl) {
    throw new Error('DATABASE_URL не задан в apps/api/.env');
  }

  const testDbName = new URL(testUrl).pathname.slice(1);

  if (!testDbName) {
    throw new Error(`Не удалось определить имя базы из DATABASE_URL_TEST: ${testUrl}`);
  }

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      testDbName,
    ]);

    if (existing.rowCount === 0) {
      // Имя базы — часть DDL, параметром его передать нельзя. Значение приходит
      // из нашего же .env, не из пользовательского ввода.
      await client.query(`CREATE DATABASE "${testDbName}"`);
      console.log(`created database ${testDbName}`);
    } else {
      console.log(`database ${testDbName} already exists`);
    }
  } finally {
    await client.end();
  }
}

void main();
