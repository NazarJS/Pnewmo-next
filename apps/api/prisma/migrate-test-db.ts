import 'dotenv/config';
import { execFileSync } from 'node:child_process';

/**
 * Применяет миграции к тестовой базе. Вариант с dotenv-cli потребовал бы новой
 * зависимости, поэтому подменяем DATABASE_URL в окружении дочернего процесса.
 */
const testUrl = process.env.DATABASE_URL_TEST;

if (!testUrl) {
  throw new Error('DATABASE_URL_TEST не задан в apps/api/.env');
}

execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testUrl },
});
