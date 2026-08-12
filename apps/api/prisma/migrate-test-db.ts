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

// shell: true обязателен для Windows: там pnpm — это pnpm.cmd, и без оболочки
// execFileSync не найдёт исполняемый файл (ENOENT).
execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: testUrl },
});
