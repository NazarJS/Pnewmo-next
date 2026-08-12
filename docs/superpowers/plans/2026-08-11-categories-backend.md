# Этап 3a: бэкенд категорий — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Первая таблица и первый доменный модуль: `categories` в Postgres через Prisma 7, пять эндпоинтов CRUD по контракту ts-rest, единая форма ошибок, сиды из мока и тесты.

**Architecture:** Слои внутри модуля — контроллер маппит сущности в DTO контракта, сервис держит бизнес-правила, репозиторий инкапсулирует запросы Prisma. `PrismaModule` глобальный, как `TypeOrmModule.forRoot()`; `CategoriesRepository` объявлен в своём модуле. Домен не знает про HTTP: сервис бросает `AppException` с кодом, статусы назначает единственный глобальный фильтр.

**Tech Stack:** Prisma 7.9.1 с драйвер-адаптером `@prisma/adapter-pg`, `pg` 8.23.0, NestJS 11.1.29, `@nestjs/config` 4.0.4, ts-rest 3.52.1, Zod 3.25.76, PostgreSQL 16, Jest 30 + supertest, `tsx` для сидов.

**Спек:** `docs/superpowers/specs/2026-08-11-categories-backend-design.md`

**Исходное состояние:** ветка `dev`, этап 1 завершён (`24e8684`). В `apps/api` работает только `GET /health`. Postgres поднят на порту 5433, база пустая.

## Global Constraints

- **Prisma 7 требует драйвер-адаптер в рантайме.** `datasourceUrl` и `new PrismaClient()` без аргументов не используются — документация прямо запрещает. Только `new PrismaClient({ adapter })`, где адаптер обёрнут вокруг `pg.Pool`.
- **Версии фиксируются точно** для `prisma`, `@prisma/client`, `@prisma/adapter-pg` — все три `7.9.1`. Расхождение мажора между CLI и клиентом ломает генерацию.
- **Zod остаётся `3.25.76`**, TypeScript — `^5.9.3`. Ограничения этапа 1 в силе: ts-rest 3.52.1 требует `zod ^3.22.3`, latest в реестре — `typescript@7`.
- **Генерируемый клиент Prisma лежит в `apps/api/src/generated/prisma`** и не попадает ни в git, ни под eslint, ни под prettier. Размещение внутри `src` обязательно: файлы вне `src` сдвигают вычисленный `rootDir` и сборка выдаёт `dist/src/main.js` вместо `dist/main.js`.
- **`moduleFormat = "cjs"`** в генераторе: `apps/api` компилируется в CommonJS (`module: nodenext` без `"type": "module"`), а Prisma 7 по умолчанию генерирует ESM.
- **Ни одной сущности Prisma наружу.** Репозиторий возвращает узкий `CategoryRow`, контроллер маппит его в DTO контракта.
- **`PrismaService` инжектится только в репозиторий.** В сервисе его нет — сервис знает лишь `CategoriesRepository`.
- **Push не выполняется.** `origin` — репозиторий NazarJS. Всё остаётся локально в `dev`.
- **`pnpm lint` завершается с кодом 1** из-за baseline этапа 1 (2 ошибки eslint в `HeaderCatalog.tsx`, 21 stylelint). Любая ошибка **сверх** этого — внесена нами и должна быть устранена. Пакеты `@pnewmo/api` и `@pnewmo/api-contract` обязаны линтоваться чисто.

## Что исправляется по ходу

**`apps/api/.env` никогда не читался.** Файл создан в этапе 1, но Nest не загружает `.env` сам, и API работал на дефолтах из `??` — то есть `PORT` и `WEB_ORIGIN` из файла не действовали, и этого никто не заметил. С `DATABASE_URL` так не выйдет: `undefined` в строке подключения даёт невнятную ошибку драйвера. Лечится `ConfigModule.forRoot({ isGlobal: true })` в Task 2, тем же способом, что в `panel-administration`.

## File Structure

| Файл | Ответственность |
|---|---|
| `apps/api/prisma/schema.prisma` | генератор, datasource, модель `Category` |
| `apps/api/prisma.config.ts` | путь к схеме, адрес базы для CLI, команда сидов |
| `apps/api/prisma/seed/categories.json` | фикстура: категории из мока, входные данные сида |
| `apps/api/prisma/seed.ts` | заливка фикстуры с построением карты `mockId → newId` |
| `apps/api/src/prisma/prisma.service.ts` | `PrismaClient` с адаптером, владеет пулом и закрывает его |
| `apps/api/src/prisma/prisma.module.ts` | `@Global`, экспортирует `PrismaService` |
| `apps/api/src/common/errors/app-error.enum.ts` | перечисление `AppError` |
| `apps/api/src/common/errors/app.exception.ts` | `AppException extends Error` с полем `code` |
| `apps/api/src/common/errors/error-mapping.ts` | чистые функции маппинга, покрыты юнит-тестами |
| `apps/api/src/common/filters/app-exception.filter.ts` | склейка: `unknown` → статус и единое тело |
| `apps/api/src/categories/categories.repository.ts` | только запросы Prisma, возвращает `CategoryRow` |
| `apps/api/src/categories/categories.service.ts` | бизнес-правила, включая защиту от цикла |
| `apps/api/src/categories/categories.controller.ts` | обработчики ts-rest, маппинг в DTO |
| `apps/api/src/categories/categories.module.ts` | сборка модуля |
| `packages/api-contract/src/category.contract.ts` | схемы и пять роутов |
| `packages/api-contract/src/app-error.ts` | `appErrorSchema`, общая для всех роутов |
| `apps/api/test/setup-env.ts` | `globalSetup`: подмена `DATABASE_URL` на тестовую базу |
| `apps/api/test/categories.e2e-spec.ts` | десять проверок HTTP-контура |
| `apps/api/src/categories/categories.service.spec.ts` | юнит-тесты защиты от цикла |
| `apps/api/src/common/errors/error-mapping.spec.ts` | юнит-тесты чистых маппингов |

---

### Task 1: Prisma 7 — схема, генерация, первая миграция

Только CLI, без кода Nest. Задача заканчивается таблицей в базе и сгенерированным клиентом, при этом `apps/api` продолжает собираться и отдавать `/health`.

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.ts`
- Modify: `apps/api/package.json`, `apps/api/tsconfig.build.json`, `apps/api/eslint.config.mjs`, `apps/api/.env.example`, `.gitignore`, корневой `package.json`
- Create: `.prettierignore`

**Interfaces:**
- Produces: таблица `categories` в базе `pnewmo`; клиент Prisma в `apps/api/src/generated/prisma`, импортируемый как `import { PrismaClient } from '../generated/prisma/client'`; команды `pnpm db:migrate`, `pnpm db:generate`, `pnpm db:studio`, `pnpm db:seed`.

- [ ] **Step 1: Установить зависимости Prisma**

```bash
cd /Users/daniildalinchuk/My-projects/Nazz
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
pnpm --filter @pnewmo/api add @prisma/client@7.9.1 @prisma/adapter-pg@7.9.1 pg@8.23.0
pnpm --filter @pnewmo/api add -D prisma@7.9.1 tsx@4.23.12 @types/pg@8.21.0 dotenv@17.4.2
```

Expected: установка проходит. Возможно предупреждение о неудовлетворённом peer `pg-native` у пакета `pg` — оно ожидаемо, это опциональный нативный драйвер, который нам не нужен.

- [ ] **Step 2: Создать `apps/api/prisma/schema.prisma`**

Блока `url` в `datasource` нет намеренно: в Prisma 7 адрес для CLI задаётся в `prisma.config.ts`, а для рантайма — строкой подключения пула. Если шаг 5 покажет, что CLI всё равно требует `url`, он возвращается сюда как `url = env("DATABASE_URL")`.

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

model Category {
  id        Int        @id @default(autoincrement())
  parentId  Int?       @map("parent_id")
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: Restrict)
  children  Category[] @relation("CategoryTree")
  slug      String     @unique
  name      String
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  @@index([parentId])
  @@map("categories")
}
```

- [ ] **Step 3: Создать `apps/api/prisma.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
```

- [ ] **Step 4: Закрыть генерируемый клиент от git и линтеров**

В корневой `.gitignore` добавить строку:

```
src/generated/
```

В `apps/api/eslint.config.mjs` расширить список `ignores` в первом объекте конфигурации:

```js
{
  ignores: ['eslint.config.mjs', 'src/generated/**', 'dist/**'],
},
```

Создать `.prettierignore` в корне репозитория:

```
apps/api/src/generated/
apps/web/.next/
**/dist/
pnpm-lock.yaml
```

- [ ] **Step 5: Добавить `DATABASE_URL_TEST` в `apps/api/.env.example` и обновить свой `.env`**

Полное содержимое `apps/api/.env.example`:

```
DATABASE_URL=postgresql://pnewmo:pnewmo_local_dev@localhost:5433/pnewmo?schema=public
DATABASE_URL_TEST=postgresql://pnewmo:pnewmo_local_dev@localhost:5433/pnewmo_test?schema=public
PORT=4000
WEB_ORIGIN=http://localhost:3000
```

Затем дописать `DATABASE_URL_TEST` в существующий `apps/api/.env` — `pnpm bootstrap` его не перезапишет, потому что файл уже есть.

- [ ] **Step 6: Пришпилить `rootDir` в `apps/api/tsconfig.build.json`**

Добавить в `compilerOptions`:

```json
"rootDir": "./src"
```

Без этого появление `prisma.config.ts` и `prisma/seed.ts` в корне приложения сдвигает вычисленный `rootDir`, и `nest build` начинает выдавать `dist/src/main.js`, из-за чего `start: node dist/main` перестаёт работать.

- [ ] **Step 7: Добавить команды в `apps/api/package.json` и корневой `package.json`**

В `apps/api/package.json`, блок `scripts`:

```json
"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:deploy": "prisma migrate deploy",
"db:seed": "prisma db seed",
"db:studio": "prisma studio"
```

В корневой `package.json`, блок `scripts`, рядом с существующими `db:up` / `db:down`:

```json
"db:generate": "pnpm --filter @pnewmo/api db:generate",
"db:migrate": "pnpm --filter @pnewmo/api db:migrate",
"db:seed": "pnpm --filter @pnewmo/api db:seed",
"db:studio": "pnpm --filter @pnewmo/api db:studio"
```

- [ ] **Step 8: Сгенерировать клиент**

```bash
pnpm db:up
pnpm db:generate
ls apps/api/src/generated/prisma/
```

Expected: команда проходит, в каталоге появляются файлы клиента, среди них `client.d.ts` и `client.js`.

Если `prisma generate` жалуется на отсутствие `url` в `datasource` — вернуть `url = env("DATABASE_URL")` в блок `datasource` схемы и повторить шаг.

- [ ] **Step 9: Создать первую миграцию**

```bash
pnpm db:migrate --name init_categories
```

Expected: создаётся каталог `apps/api/prisma/migrations/<timestamp>_init_categories/` с файлом `migration.sql`, миграция применяется.

- [ ] **Step 10: Проверить структуру таблицы в базе**

```bash
pnpm db:psql -c '\d categories'
```

Expected: колонки `id`, `parent_id`, `slug`, `name`, `created_at`, `updated_at`; уникальный индекс по `slug`; индекс по `parent_id`; внешний ключ `categories_parent_id_fkey` на саму таблицу с `ON DELETE RESTRICT`.

- [ ] **Step 11: Проверить, что сборка и `/health` не сломались**

```bash
pnpm --filter @pnewmo/api build
ls apps/api/dist/main.js
pnpm --filter @pnewmo/api lint
pnpm --filter @pnewmo/api typecheck
```

Expected: `dist/main.js` существует (не `dist/src/main.js`), lint и typecheck зелёные. Это проверка того, что шаг 6 сработал и что генерируемый клиент не попал под линтеры.

- [ ] **Step 12: Коммит**

```bash
git add -A
git commit -m "feat: add Prisma 7 with the Category table

Prisma 7 renames the generator to prisma-client, makes output mandatory
and needs moduleFormat cjs against our nodenext build. The generated
client lives inside src because files outside it shift the inferred
rootDir and break start: node dist/main; tsconfig.build.json now pins
rootDir explicitly."
```

---

### Task 2: `PrismaService`, глобальный `PrismaModule` и загрузка `.env`

**Files:**
- Create: `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`, `apps/api/test/setup-env.ts`, `apps/api/test/prisma.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/test/jest-e2e.json`, `apps/api/package.json`, корневой `package.json`, `docker-compose.yml` не трогаем

**Interfaces:**
- Consumes: клиент Prisma из Task 1.
- Produces: `PrismaService` — инжектируемый `PrismaClient`, доступный без импорта модуля; тестовая база `pnewmo_test` и команда `pnpm db:test:setup`; `globalSetup`, подменяющий `DATABASE_URL` в e2e-прогонах.

- [ ] **Step 1: Установить `@nestjs/config`**

```bash
pnpm --filter @pnewmo/api add @nestjs/config@4.0.4
```

- [ ] **Step 2: Написать падающий e2e-тест на подключение к базе**

Create `apps/api/test/prisma.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PrismaService', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('connects to the database', async () => {
    const rows = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 AS one`;

    expect(rows[0]?.one).toBe(1);
  });

  it('points at the test database, not the dev one', async () => {
    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;

    expect(rows[0]?.db).toBe('pnewmo_test');
  });
});
```

Второй тест важнее первого: он не даёт тестам незаметно уехать в dev-базу и затирать данные.

- [ ] **Step 3: Запустить и убедиться, что тест падает**

```bash
pnpm --filter @pnewmo/api test:e2e prisma.e2e-spec
```

Expected: FAIL — модуль `../src/prisma/prisma.service` не существует.

- [ ] **Step 4: Создать `PrismaService`**

Create `apps/api/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    // Пул создаётся до super() и запоминается после: в конструкторе нельзя
    // обращаться к this раньше вызова super.
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
```

Адрес базы берётся через `ConfigService`, а не из `process.env` напрямую. Причина в порядке инициализации: `ConfigService` — это зависимость в конструкторе, поэтому Nest гарантированно создаст его раньше. Чтение `process.env` в поле класса сработало бы до загрузки `.env` модулем конфигурации.

`getOrThrow` вместо `get` — при отсутствующей переменной падаем сразу с внятным сообщением, а не получаем `undefined` в строке подключения и невнятную ошибку драйвера.

- [ ] **Step 5: Создать глобальный `PrismaModule`**

Create `apps/api/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 6: Подключить `ConfigModule` и `PrismaModule` в `AppModule`**

Полное содержимое `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
```

`ConfigModule.forRoot` без `envFilePath` ищет `.env` в рабочем каталоге процесса. Для `nest start` и для Jest это `apps/api`, где файл и лежит.

- [ ] **Step 7: Создать тестовую базу и скрипт её подготовки**

В `apps/api/package.json`, блок `scripts`:

```json
"db:test:setup": "tsx prisma/setup-test-db.ts"
```

Create `apps/api/prisma/setup-test-db.ts`:

```ts
import 'dotenv/config';
import { Client } from 'pg';

async function main(): Promise<void> {
  const testUrl = process.env.DATABASE_URL_TEST;

  if (!testUrl) {
    throw new Error('DATABASE_URL_TEST не задан в apps/api/.env');
  }

  const testDbName = new URL(testUrl).pathname.slice(1);
  const adminUrl = process.env.DATABASE_URL;

  if (!adminUrl) {
    throw new Error('DATABASE_URL не задан в apps/api/.env');
  }

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDbName]);

  if (existing.rowCount === 0) {
    // Имя базы нельзя передать параметром — оно часть DDL. Значение приходит
    // из нашего же .env, не из запроса пользователя.
    await client.query(`CREATE DATABASE "${testDbName}"`);
    console.log(`created database ${testDbName}`);
  } else {
    console.log(`database ${testDbName} already exists`);
  }

  await client.end();
}

void main();
```

В корневой `package.json` — только проброс вызова; применение миграций к тестовой базе идёт отдельной командой в следующем шаге:

```json
"db:test:setup": "pnpm --filter @pnewmo/api db:test:setup"
```

- [ ] **Step 8: Применить миграции к тестовой базе**

Вариант с `dotenv-cli` (`dotenv -e .env -v DATABASE_URL=$DATABASE_URL_TEST -- prisma migrate deploy`) требует пакета, которого у нас нет. Обходимся скриптом на уже установленном `tsx`.

Create `apps/api/prisma/migrate-test-db.ts`:

```ts
import 'dotenv/config';
import { execFileSync } from 'node:child_process';

const testUrl = process.env.DATABASE_URL_TEST;

if (!testUrl) {
  throw new Error('DATABASE_URL_TEST не задан в apps/api/.env');
}

execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testUrl },
});
```

В `apps/api/package.json`:

```json
"db:test:migrate": "tsx prisma/migrate-test-db.ts"
```

Запустить:

```bash
pnpm --filter @pnewmo/api db:test:setup
pnpm --filter @pnewmo/api db:test:migrate
```

Expected: `created database pnewmo_test`, затем применение миграции `init_categories`.

- [ ] **Step 9: Подменить `DATABASE_URL` для e2e-прогонов**

Create `apps/api/test/setup-env.ts`:

```ts
import { config } from 'dotenv';

export default function globalSetup(): void {
  config();

  const testUrl = process.env.DATABASE_URL_TEST;

  if (!testUrl) {
    throw new Error(
      'DATABASE_URL_TEST не задан. Выполните: pnpm --filter @pnewmo/api db:test:setup',
    );
  }

  process.env.DATABASE_URL = testUrl;
}
```

Полное содержимое `apps/api/test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "globalSetup": "<rootDir>/setup-env.ts",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

- [ ] **Step 10: Запустить тест и убедиться, что он проходит**

```bash
pnpm --filter @pnewmo/api test:e2e -- prisma.e2e-spec
```

Expected: PASS, 2 теста. Второй подтверждает, что подключение ушло в `pnewmo_test`, а не в `pnewmo`.

- [ ] **Step 11: Проверить, что процесс Jest завершается**

```bash
pnpm --filter @pnewmo/api test:e2e 2>&1 | tail -5
```

Expected: вывод заканчивается сводкой тестов, процесс возвращает управление. Предупреждения `A worker process has failed to exit gracefully` быть не должно — если оно есть, пул `pg` не закрылся, и надо проверить, что `onModuleDestroy` вызывается (`app.close()` в `afterAll`).

- [ ] **Step 12: Проверить, что `/health` и остальные тесты живы**

```bash
pnpm --filter @pnewmo/api test:e2e
pnpm --filter @pnewmo/api lint
pnpm --filter @pnewmo/api typecheck
```

Expected: все e2e проходят (health + prisma), lint и typecheck зелёные.

- [ ] **Step 13: Коммит**

```bash
git add -A
git commit -m "feat: wire PrismaService with a pg driver adapter

Prisma 7 needs an explicit adapter at runtime, so PrismaService owns the
pg.Pool and closes it in onModuleDestroy — an unclosed pool leaves Jest
hanging.

Also fixes a latent bug from stage 1: apps/api/.env was never loaded, so
PORT and WEB_ORIGIN from the file had no effect and the app silently ran
on the ?? defaults. ConfigModule.forRoot({ isGlobal: true }) loads it, and
PrismaService reads DATABASE_URL through ConfigService so initialisation
order is guaranteed.

E2E tests run against a separate pnewmo_test database, and one test
asserts current_database() so they cannot silently fall back to dev."
```

---

### Task 3: Сиды из категорий мока

**Files:**
- Create: `apps/api/prisma/seed/categories.json`, `apps/api/prisma/seed.ts`

**Interfaces:**
- Consumes: `PrismaClient` из Task 1, таблица `categories`.
- Produces: 40 категорий в базе с вложенностью до 5 уровней; команда `pnpm db:seed`.

- [ ] **Step 1: Собрать фикстуру из `db.json`**

```bash
cd /Users/daniildalinchuk/My-projects/Nazz
mkdir -p apps/api/prisma/seed
node -e "
const fs = require('fs');
const db = JSON.parse(fs.readFileSync('apps/web/db.json', 'utf8'));
fs.writeFileSync(
  'apps/api/prisma/seed/categories.json',
  JSON.stringify(db.categories, null, 2) + '\n',
);
console.log('categories written:', db.categories.length);
const depths = db.categories.map((c) => String(c.path).split('.').length);
console.log('max depth:', Math.max(...depths));
"
```

Expected: `categories written: 40`, `max depth: 5`.

Фикстура — копия, а не чтение `apps/web/db.json` в рантайме: приложение не должно зависеть от файлов другого приложения, иначе удаление мока в этапе 4 сломает сиды бэкенда.

- [ ] **Step 2: Написать сид**

Create `apps/api/prisma/seed.ts`:

```ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../src/generated/prisma/client';

interface MockCategory {
  id: string | number;
  parent_id: string | number | null;
  path: string;
  slug: string;
  name: string;
}

function loadFixture(): MockCategory[] {
  const raw = readFileSync(join(__dirname, 'seed', 'categories.json'), 'utf8');

  return JSON.parse(raw) as MockCategory[];
}

function depthOf(category: MockCategory): number {
  return String(category.path).split('.').length;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL не задан');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  // TRUNCATE, а не deleteMany: onDelete Restrict проверяется немедленно на
  // каждой строке, поэтому массовое удаление самоссылающейся таблицы может
  // упасть на порядке строк. RESTART IDENTITY делает идентификаторы
  // предсказуемыми между прогонами, CASCADE понадобится, когда на categories
  // будут ссылаться товары.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE categories RESTART IDENTITY CASCADE');

  // Вставка по возрастанию глубины: внешний ключ требует, чтобы родитель уже
  // существовал.
  const ordered = [...loadFixture()].sort((a, b) => depthOf(a) - depthOf(b));
  const idMap = new Map<string, number>();

  for (const category of ordered) {
    const mockId = String(category.id);
    const mockParentId = category.parent_id === null ? null : String(category.parent_id);

    let parentId: number | null = null;

    if (mockParentId !== null) {
      const mapped = idMap.get(mockParentId);

      if (mapped === undefined) {
        throw new Error(
          `Родитель ${mockParentId} категории ${mockId} ещё не вставлен — проверьте поле path в фикстуре`,
        );
      }

      parentId = mapped;
    }

    const created = await prisma.category.create({
      data: { name: category.name, slug: category.slug, parentId },
      select: { id: true },
    });

    idMap.set(mockId, created.id);
  }

  console.log(`seeded ${idMap.size} categories`);

  await prisma.$disconnect();
  await pool.end();
}

void main();
```

- [ ] **Step 3: Залить сиды**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
pnpm db:seed
```

Expected: `seeded 40 categories`.

- [ ] **Step 4: Проверить данные и вложенность**

```bash
pnpm db:psql -tAc "SELECT count(*) FROM categories;"
pnpm db:psql -tAc "SELECT name FROM categories WHERE parent_id IS NULL ORDER BY name;"
pnpm db:psql -tAc "
WITH RECURSIVE t AS (
  SELECT id, name, 1 AS depth FROM categories WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.name, t.depth + 1 FROM categories c JOIN t ON c.parent_id = t.id
)
SELECT max(depth) FROM t;"
```

Expected: `40`; три корневые категории — «Вакуумная техника», «Гидравлика», «Пневматика»; максимальная глубина `5`.

Последний запрос — тот самый `WITH RECURSIVE`, который мы решили не тащить в приложение. Здесь он уместен: разовая проверка данных, а не запрос на каждый рендер.

- [ ] **Step 5: Проверить, что последовательность не сломана**

```bash
pnpm db:psql -tAc "INSERT INTO categories (slug, name, updated_at) VALUES ('seq-check', 'Проверка', now()) RETURNING id;"
pnpm db:psql -tAc "DELETE FROM categories WHERE slug = 'seq-check';"
```

Expected: первая команда возвращает `41` без ошибки уникальности. Это подтверждает, что автоинкремент продолжился с конца, а не начал заново — та самая ловушка, которая возникла бы при вставке явных идентификаторов.

- [ ] **Step 6: Проверить идемпотентность**

```bash
pnpm db:seed
pnpm db:psql -tAc "SELECT count(*) FROM categories;"
```

Expected: снова `seeded 40 categories` и ровно `40` строк — повторный прогон не дублирует данные.

- [ ] **Step 7: Коммит**

```bash
git add -A
git commit -m "feat: seed categories from the mock catalogue

40 categories, five levels deep, ids assigned by the database. The mock
ids are not carried over: nothing crosses the Postgres/json-server
boundary by id, only by slug, so preserving them would buy nothing.

Uses TRUNCATE rather than deleteMany because onDelete Restrict is checked
per row immediately, which makes a bulk delete of a self-referencing table
order-dependent."
```

---

### Task 4: Контракт категорий

**Files:**
- Create: `packages/api-contract/src/app-error.ts`, `packages/api-contract/src/category.contract.ts`
- Modify: `packages/api-contract/src/index.ts`

**Interfaces:**
- Produces: `contract.categories.{list,getById,create,update,remove}`; схемы `categorySchema`, `createCategorySchema`, `updateCategorySchema`, `appErrorSchema`; типы `Category`, `CreateCategoryInput`, `UpdateCategoryInput`, `AppErrorBody`.

- [ ] **Step 1: Создать общую схему ошибки**

Create `packages/api-contract/src/app-error.ts`:

```ts
import { z } from 'zod';

export const appErrorSchema = z.object({
  errorCode: z.string(),
  message: z.string(),
  issues: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

export type AppErrorBody = z.infer<typeof appErrorSchema>;
```

- [ ] **Step 2: Создать контракт категорий**

Create `packages/api-contract/src/category.contract.ts`:

```ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { appErrorSchema } from './app-error';

const c = initContract();

export const categorySchema = z.object({
  id: z.number().int(),
  parentId: z.number().int().nullable(),
  slug: z.string(),
  name: z.string(),
});

export type Category = z.infer<typeof categorySchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9_-]+$/),
  parentId: z.number().int().positive().nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// coerce обязателен: параметр пути приходит строкой, и без приведения Zod
// отвергнет корректный запрос как «не число».
const idParam = z.object({ id: z.coerce.number().int().positive() });

export const categoryContract = c.router({
  list: {
    method: 'GET',
    path: '/categories',
    responses: {
      200: z.array(categorySchema),
    },
    summary: 'Все категории плоским списком',
  },
  getById: {
    method: 'GET',
    path: '/categories/:id',
    pathParams: idParam,
    responses: {
      200: categorySchema,
      404: appErrorSchema,
    },
    summary: 'Категория по идентификатору',
  },
  create: {
    method: 'POST',
    path: '/categories',
    body: createCategorySchema,
    responses: {
      201: categorySchema,
      400: appErrorSchema,
      409: appErrorSchema,
    },
    summary: 'Создать категорию',
  },
  update: {
    method: 'PATCH',
    path: '/categories/:id',
    pathParams: idParam,
    body: updateCategorySchema,
    responses: {
      200: categorySchema,
      400: appErrorSchema,
      404: appErrorSchema,
      409: appErrorSchema,
    },
    summary: 'Изменить категорию',
  },
  remove: {
    method: 'DELETE',
    path: '/categories/:id',
    pathParams: idParam,
    responses: {
      200: z.object({ id: z.number().int() }),
      404: appErrorSchema,
      409: appErrorSchema,
    },
    summary: 'Удалить категорию',
  },
});
```

- [ ] **Step 3: Подключить к корневому контракту**

Полное содержимое `packages/api-contract/src/index.ts`:

```ts
import { initContract } from '@ts-rest/core';

import { categoryContract } from './category.contract';
import { healthContract } from './health.contract';

const c = initContract();

export const contract = c.router({
  health: healthContract,
  categories: categoryContract,
});

export * from './app-error';
export * from './category.contract';
export * from './health.contract';
```

- [ ] **Step 4: Собрать и проверить, что типы выведены**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
pnpm --filter @pnewmo/api-contract build
grep -c 'parentId' packages/api-contract/dist/category.contract.d.ts
grep -n 'issues' packages/api-contract/dist/app-error.d.ts | head -2
```

Expected: сборка проходит; `parentId` встречается в объявлениях; поле `issues` присутствует в типе ошибки.

- [ ] **Step 5: Коммит**

```bash
git add -A
git commit -m "feat: add the categories contract with five CRUD routes

One error schema for every failure, with an optional issues array so
validation failures and domain errors share a shape the client parses once.

Path params use z.coerce.number(): URL params arrive as strings and plain
z.number() would reject every valid request."
```

---

### Task 5: Ошибки — перечисление, исключение, чистые маппинги, фильтр

**Files:**
- Create: `apps/api/src/common/errors/app-error.enum.ts`, `apps/api/src/common/errors/app.exception.ts`, `apps/api/src/common/errors/error-mapping.ts`, `apps/api/src/common/errors/error-mapping.spec.ts`, `apps/api/src/common/filters/app-exception.filter.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**
- Produces: `AppError` (перечисление), `AppException(code, message)`, `statusByAppError`, `appErrorByPrismaCode(code: string): AppError | null`, `appErrorByStatus(status: number): AppError`, `extractTsRestIssues(body: unknown): ValidationIssue[] | null`, `AppExceptionFilter`.

- [ ] **Step 1: Проверить, как включается проверка ответов в этой версии ts-rest**

```bash
cd /Users/daniildalinchuk/My-projects/Nazz
D=$(find node_modules/.pnpm -path '*@ts-rest+nest*/node_modules/@ts-rest/nest' -maxdepth 4 -type d | head -1)
grep -oE 'TsRestModule|validateResponses' "$D"/index.cjs.js | sort -u
```

Expected: обе строки присутствуют. Это подтверждает, что `TsRestModule.register({ validateResponses: true })` из шага 8 существует в 3.52.1. Если `TsRestModule` не найдётся — в шаге 8 используется декоратор `@TsRest({ validateResponses: true })` на классе контроллера в Task 7.

Форма тела ошибки валидации в маппинге ниже написана по документированной структуре Zod. Фактическая проверяется на живом запросе в Task 7, Step 9, и при расхождении маппинг правится там же.

- [ ] **Step 2: Создать перечисление и исключение**

Create `apps/api/src/common/errors/app-error.enum.ts`:

```ts
export enum AppError {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONFLICT = 'CONFLICT',
  INTERNAL = 'INTERNAL',
}
```

Create `apps/api/src/common/errors/app.exception.ts`:

```ts
import { AppError } from './app-error.enum';

/**
 * Доменное исключение. Наследует Error, а не HttpException, намеренно:
 * сервис не знает про HTTP-статусы, их назначает AppExceptionFilter.
 */
export class AppException extends Error {
  constructor(
    readonly code: AppError,
    message: string,
  ) {
    super(message);
    this.name = 'AppException';
  }
}
```

- [ ] **Step 3: Написать падающие юнит-тесты на чистые маппинги**

Create `apps/api/src/common/errors/error-mapping.spec.ts`:

```ts
import { AppError } from './app-error.enum';
import {
  appErrorByPrismaCode,
  appErrorByStatus,
  extractTsRestIssues,
  statusByAppError,
} from './error-mapping';

describe('statusByAppError', () => {
  it('maps every AppError to a status', () => {
    expect(statusByAppError[AppError.NOT_FOUND]).toBe(404);
    expect(statusByAppError[AppError.VALIDATION_FAILED]).toBe(400);
    expect(statusByAppError[AppError.CONFLICT]).toBe(409);
    expect(statusByAppError[AppError.INTERNAL]).toBe(500);
  });
});

describe('appErrorByPrismaCode', () => {
  it('maps a unique constraint violation to a conflict', () => {
    expect(appErrorByPrismaCode('P2002')).toBe(AppError.CONFLICT);
  });

  it('maps a foreign key violation to a conflict', () => {
    expect(appErrorByPrismaCode('P2003')).toBe(AppError.CONFLICT);
  });

  it('maps a missing record to not found', () => {
    expect(appErrorByPrismaCode('P2025')).toBe(AppError.NOT_FOUND);
  });

  it('returns null for codes it does not know', () => {
    expect(appErrorByPrismaCode('P1001')).toBeNull();
  });
});

describe('appErrorByStatus', () => {
  it('derives a code from a known status', () => {
    expect(appErrorByStatus(404)).toBe(AppError.NOT_FOUND);
    expect(appErrorByStatus(400)).toBe(AppError.VALIDATION_FAILED);
    expect(appErrorByStatus(409)).toBe(AppError.CONFLICT);
  });

  it('falls back to internal for anything else', () => {
    expect(appErrorByStatus(418)).toBe(AppError.INTERNAL);
  });
});

describe('extractTsRestIssues', () => {
  it('returns null for a body that is not a ts-rest validation error', () => {
    expect(extractTsRestIssues({ message: 'nope' })).toBeNull();
    expect(extractTsRestIssues(null)).toBeNull();
    expect(extractTsRestIssues('string')).toBeNull();
  });

  it('flattens issues from every result key', () => {
    const body = {
      paramsResult: null,
      headersResult: null,
      queryResult: null,
      bodyResult: {
        issues: [
          { path: ['slug'], message: 'Invalid' },
          { path: ['parentId'], message: 'Expected number' },
        ],
      },
    };

    expect(extractTsRestIssues(body)).toEqual([
      { path: 'slug', message: 'Invalid' },
      { path: 'parentId', message: 'Expected number' },
    ]);
  });

  it('returns an empty array when the shape matches but no issues are present', () => {
    expect(extractTsRestIssues({ bodyResult: null, paramsResult: null })).toEqual([]);
  });

  it('joins nested paths with a dot', () => {
    const body = { bodyResult: { issues: [{ path: ['parent', 'id'], message: 'Required' }] } };

    expect(extractTsRestIssues(body)).toEqual([{ path: 'parent.id', message: 'Required' }]);
  });
});
```

- [ ] **Step 4: Запустить и убедиться, что тесты падают**

```bash
pnpm --filter @pnewmo/api test
```

Expected: FAIL — модуль `./error-mapping` не найден.

- [ ] **Step 5: Реализовать чистые маппинги**

Create `apps/api/src/common/errors/error-mapping.ts`:

```ts
import { AppError } from './app-error.enum';

export const statusByAppError: Record<AppError, number> = {
  [AppError.NOT_FOUND]: 404,
  [AppError.VALIDATION_FAILED]: 400,
  [AppError.CONFLICT]: 409,
  [AppError.INTERNAL]: 500,
};

export function appErrorByPrismaCode(code: string): AppError | null {
  switch (code) {
    case 'P2002':
      return AppError.CONFLICT;
    case 'P2003':
      return AppError.CONFLICT;
    case 'P2025':
      return AppError.NOT_FOUND;
    default:
      return null;
  }
}

export function appErrorByStatus(status: number): AppError {
  switch (status) {
    case 400:
      return AppError.VALIDATION_FAILED;
    case 404:
      return AppError.NOT_FOUND;
    case 409:
      return AppError.CONFLICT;
    default:
      return AppError.INTERNAL;
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const RESULT_KEYS = ['paramsResult', 'headersResult', 'queryResult', 'bodyResult'] as const;

/**
 * @ts-rest/nest бросает RequestValidationError extends BadRequestException с
 * телом { paramsResult, headersResult, queryResult, bodyResult }. Сам класс не
 * экспортирован в типах пакета, поэтому распознаём по форме тела — так не
 * зависим от неэкспортированного типа и от смены его имени.
 */
export function extractTsRestIssues(body: unknown): ValidationIssue[] | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;

  if (!RESULT_KEYS.some((key) => key in record)) {
    return null;
  }

  const issues: ValidationIssue[] = [];

  for (const key of RESULT_KEYS) {
    const result = record[key];

    if (typeof result !== 'object' || result === null) {
      continue;
    }

    const rawIssues = (result as { issues?: unknown }).issues;

    if (!Array.isArray(rawIssues)) {
      continue;
    }

    for (const raw of rawIssues) {
      const issue = raw as { path?: unknown; message?: unknown };

      issues.push({
        path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path ?? ''),
        message: typeof issue.message === 'string' ? issue.message : 'Некорректное значение',
      });
    }
  }

  return issues;
}
```

- [ ] **Step 6: Запустить тесты и убедиться, что они проходят**

```bash
pnpm --filter @pnewmo/api test
```

Expected: PASS, 11 тестов.

- [ ] **Step 7: Создать фильтр**

Create `apps/api/src/common/filters/app-exception.filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { AppErrorBody } from '@pnewmo/api-contract';
import type { Response } from 'express';

import { AppError } from '../errors/app-error.enum';
import { AppException } from '../errors/app.exception';
import {
  appErrorByPrismaCode,
  appErrorByStatus,
  extractTsRestIssues,
  statusByAppError,
} from '../errors/error-mapping';

interface PrismaKnownError {
  code: string;
  message: string;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('P')
  );
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.describe(exception);

    response.status(status).json(body);
  }

  private describe(exception: unknown): { status: number; body: AppErrorBody } {
    if (exception instanceof AppException) {
      return {
        status: statusByAppError[exception.code],
        body: { errorCode: exception.code, message: exception.message },
      };
    }

    if (isPrismaKnownError(exception)) {
      const code = appErrorByPrismaCode(exception.code);

      if (code) {
        return {
          status: statusByAppError[code],
          body: { errorCode: code, message: this.prismaMessage(exception.code) },
        };
      }

      this.logger.error(`Необработанная ошибка Prisma ${exception.code}`, exception.message);

      return {
        status: 500,
        body: { errorCode: AppError.INTERNAL, message: 'Внутренняя ошибка сервера' },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const issues = extractTsRestIssues(exception.getResponse());

      if (issues) {
        return {
          status: 400,
          body: {
            errorCode: AppError.VALIDATION_FAILED,
            message: 'Некорректные данные запроса',
            issues,
          },
        };
      }

      return {
        status,
        body: { errorCode: appErrorByStatus(status), message: exception.message },
      };
    }

    this.logger.error('Необработанное исключение', exception instanceof Error ? exception.stack : String(exception));

    return {
      status: 500,
      body: { errorCode: AppError.INTERNAL, message: 'Внутренняя ошибка сервера' },
    };
  }

  private prismaMessage(code: string): string {
    switch (code) {
      case 'P2002':
        return 'Запись с таким значением уже существует';
      case 'P2003':
        return 'Нельзя выполнить операцию: на запись ссылаются другие данные';
      case 'P2025':
        return 'Запись не найдена';
      default:
        return 'Внутренняя ошибка сервера';
    }
  }
}
```

Наружу уходит только своё сообщение, никогда `exception.message` от Prisma: в нём встречаются имена таблиц и фрагменты схемы.

- [ ] **Step 8: Зарегистрировать фильтр и включить проверку ответов**

Полное содержимое `apps/api/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AppExceptionFilter());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });

  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
```

В `apps/api/src/app.module.ts` добавить импорт `TsRestModule` с включённой проверкой ответов:

```ts
import { TsRestModule } from '@ts-rest/nest';

// в массиве imports, первым после ConfigModule:
TsRestModule.register({ validateResponses: true }),
```

Наличие `TsRestModule.register` уже подтверждено в шаге 1. Если он всё же не заводится, альтернатива — декоратор `@TsRest({ validateResponses: true })` на классе контроллера в Task 7.

- [ ] **Step 9: Проверить, что приложение поднимается с фильтром**

```bash
pnpm --filter @pnewmo/api test:e2e
pnpm --filter @pnewmo/api lint
pnpm --filter @pnewmo/api typecheck
```

Expected: существующие e2e (health, prisma) проходят, lint и typecheck зелёные.

- [ ] **Step 10: Коммит**

```bash
git add -A
git commit -m "feat: one error shape for every failure

AppException extends Error rather than HttpException so the domain stays
free of HTTP; the filter assigns statuses. Prisma codes map to domain
codes, and ts-rest validation failures are recognised by response body
shape because @ts-rest/nest does not export RequestValidationError in its
types.

Prisma messages never reach the client — they carry table names and
schema fragments."
```

---

### Task 6: Репозиторий, сервис и защита от цикла

**Files:**
- Create: `apps/api/src/categories/categories.repository.ts`, `apps/api/src/categories/categories.service.ts`, `apps/api/src/categories/categories.service.spec.ts`
- Modify: нет

**Interfaces:**
- Consumes: `PrismaService` (Task 2), `AppException` и `AppError` (Task 5).
- Produces: `CategoryRow` (`{ id: number; parentId: number | null; slug: string; name: string }`); `CategoriesRepository` с методами `getList`, `getById`, `getParentId`, `create`, `update`, `remove`; `CategoriesService` с методами `getList`, `getById`, `create`, `update`, `remove`.

- [ ] **Step 1: Создать репозиторий**

Create `apps/api/src/categories/categories.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface CategoryRow {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
}

// Явный select вместо выборки всей строки: createdAt и updatedAt наружу не
// нужны, а то, что не выбрано, невозможно случайно отдать клиенту.
const columns = { id: true, parentId: true, slug: true, name: true } as const;

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  getList(): Promise<CategoryRow[]> {
    return this.prisma.category.findMany({
      select: columns,
      orderBy: [{ parentId: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
    });
  }

  getById(id: number): Promise<CategoryRow | null> {
    return this.prisma.category.findUnique({ where: { id }, select: columns });
  }

  getParentId(id: number): Promise<{ parentId: number | null } | null> {
    return this.prisma.category.findUnique({ where: { id }, select: { parentId: true } });
  }

  create(data: { name: string; slug: string; parentId: number | null }): Promise<CategoryRow> {
    return this.prisma.category.create({ data, select: columns });
  }

  update(
    id: number,
    data: { name?: string; slug?: string; parentId?: number | null },
  ): Promise<CategoryRow> {
    return this.prisma.category.update({ where: { id }, data, select: columns });
  }

  remove(id: number): Promise<CategoryRow> {
    return this.prisma.category.delete({ where: { id }, select: columns });
  }
}
```

Если `orderBy` с `nulls: 'first'` вызовет ошибку типов или рантайма, заменить на `orderBy: [{ parentId: 'asc' }, { name: 'asc' }]` — при 40 строках порядок `NULL` в списке несущественен, а дерево всё равно собирает клиент.

- [ ] **Step 2: Написать падающие юнит-тесты на сервис**

Create `apps/api/src/categories/categories.service.spec.ts`:

```ts
import { AppError } from '../common/errors/app-error.enum';
import { AppException } from '../common/errors/app.exception';
import { CategoriesRepository, CategoryRow } from './categories.repository';
import { CategoriesService } from './categories.service';

/**
 * Дерево для тестов:
 *   1 Гидравлика
 *     └ 2 Смазочная техника
 *         └ 3 Станции насосные
 *   4 Пневматика (не связана с первой ветвью)
 */
const rows: CategoryRow[] = [
  { id: 1, parentId: null, slug: 'gidravlika', name: 'Гидравлика' },
  { id: 2, parentId: 1, slug: 'smazka', name: 'Смазочная техника' },
  { id: 3, parentId: 2, slug: 'stancii', name: 'Станции насосные' },
  { id: 4, parentId: null, slug: 'pnevmatika', name: 'Пневматика' },
];

// Тип Pick даёт контекстную типизацию литералу: без него параметры стали бы
// неявными any и strict-режим отверг бы файл.
type RepositoryStub = Pick<
  CategoriesRepository,
  'getList' | 'getById' | 'getParentId' | 'create' | 'update' | 'remove'
>;

function makeRepository(): CategoriesRepository {
  const byId = new Map(rows.map((row) => [row.id, row]));

  const stub: RepositoryStub = {
    getList: () => Promise.resolve(rows),
    getById: (id) => Promise.resolve(byId.get(id) ?? null),
    getParentId: (id) => {
      const row = byId.get(id);

      return Promise.resolve(row ? { parentId: row.parentId } : null);
    },
    create: (data) => Promise.resolve({ id: 99, ...data }),
    update: (id, data) => Promise.resolve({ ...(byId.get(id) as CategoryRow), ...data }),
    remove: (id) => Promise.resolve(byId.get(id) as CategoryRow),
  };

  // Двойное приведение необходимо: у класса есть приватное поле prisma,
  // поэтому структурного совпадения недостаточно.
  return stub as unknown as CategoriesRepository;
}

function expectAppError(error: unknown, code: AppError): void {
  expect(error).toBeInstanceOf(AppException);
  expect((error as AppException).code).toBe(code);
}

describe('CategoriesService.update — защита от цикла', () => {
  let service: CategoriesService;

  beforeEach(() => {
    service = new CategoriesService(makeRepository());
  });

  it('отклоняет категорию как родителя самой себя', async () => {
    try {
      await service.update(1, { parentId: 1 });
      throw new Error('ожидалась ошибка');
    } catch (error) {
      expectAppError(error, AppError.VALIDATION_FAILED);
    }
  });

  it('отклоняет прямого потомка как родителя', async () => {
    try {
      await service.update(1, { parentId: 2 });
      throw new Error('ожидалась ошибка');
    } catch (error) {
      expectAppError(error, AppError.VALIDATION_FAILED);
    }
  });

  it('отклоняет потомка третьего уровня как родителя', async () => {
    try {
      await service.update(1, { parentId: 3 });
      throw new Error('ожидалась ошибка');
    } catch (error) {
      expectAppError(error, AppError.VALIDATION_FAILED);
    }
  });

  it('разрешает несвязанную категорию как родителя', async () => {
    const updated = await service.update(1, { parentId: 4 });

    expect(updated.parentId).toBe(4);
  });

  it('разрешает перенос в корень', async () => {
    const updated = await service.update(2, { parentId: null });

    expect(updated.parentId).toBeNull();
  });
});

describe('CategoriesService.create', () => {
  let service: CategoriesService;

  beforeEach(() => {
    service = new CategoriesService(makeRepository());
  });

  it('отклоняет несуществующего родителя', async () => {
    try {
      await service.create({ name: 'Новая', slug: 'novaya', parentId: 777 });
      throw new Error('ожидалась ошибка');
    } catch (error) {
      expectAppError(error, AppError.VALIDATION_FAILED);
    }
  });

  it('создаёт корневую категорию', async () => {
    const created = await service.create({ name: 'Новая', slug: 'novaya', parentId: null });

    expect(created.slug).toBe('novaya');
  });
});

describe('CategoriesService.getById', () => {
  it('бросает NOT_FOUND для неизвестного идентификатора', async () => {
    const service = new CategoriesService(makeRepository());

    try {
      await service.getById(777);
      throw new Error('ожидалась ошибка');
    } catch (error) {
      expectAppError(error, AppError.NOT_FOUND);
    }
  });
});
```

- [ ] **Step 3: Запустить и убедиться, что тесты падают**

```bash
pnpm --filter @pnewmo/api test
```

Expected: FAIL — модуль `./categories.service` не найден.

- [ ] **Step 4: Реализовать сервис**

Create `apps/api/src/categories/categories.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.enum';
import { AppException } from '../common/errors/app.exception';
import { CategoriesRepository, CategoryRow } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  getList(): Promise<CategoryRow[]> {
    return this.repository.getList();
  }

  async getById(id: number): Promise<CategoryRow> {
    const category = await this.repository.getById(id);

    if (!category) {
      throw new AppException(AppError.NOT_FOUND, `Категория ${id} не найдена`);
    }

    return category;
  }

  async create(data: {
    name: string;
    slug: string;
    parentId: number | null;
  }): Promise<CategoryRow> {
    await this.assertParentExists(data.parentId);

    return this.repository.create(data);
  }

  async update(
    id: number,
    data: { name?: string; slug?: string; parentId?: number | null },
  ): Promise<CategoryRow> {
    await this.getById(id);

    if (data.parentId !== undefined) {
      await this.assertParentExists(data.parentId);
      await this.assertNoCycle(id, data.parentId);
    }

    return this.repository.update(id, data);
  }

  async remove(id: number): Promise<{ id: number }> {
    await this.getById(id);

    const removed = await this.repository.remove(id);

    return { id: removed.id };
  }

  private async assertParentExists(parentId: number | null | undefined): Promise<void> {
    if (parentId === null || parentId === undefined) {
      return;
    }

    const parent = await this.repository.getById(parentId);

    if (!parent) {
      throw new AppException(
        AppError.VALIDATION_FAILED,
        `Родительская категория ${parentId} не найдена`,
      );
    }
  }

  /**
   * Ни Zod, ни внешний ключ не поймают цикл: форма запроса корректна, и ссылка
   * ведёт на существующую строку. А результат — поддерево, недостижимое из
   * корня, которое просто исчезает из меню без единой ошибки в логах.
   */
  private async assertNoCycle(id: number, newParentId: number | null): Promise<void> {
    if (newParentId === null) {
      return;
    }

    if (newParentId === id) {
      throw new AppException(
        AppError.VALIDATION_FAILED,
        'Категория не может быть родителем самой себя',
      );
    }

    const visited = new Set<number>();
    let cursor: number | null = newParentId;

    while (cursor !== null) {
      if (cursor === id) {
        throw new AppException(
          AppError.VALIDATION_FAILED,
          'Нельзя переместить категорию в её собственного потомка',
        );
      }

      // Страховка от уже испорченных данных: если цикл каким-то образом попал
      // в базу, обход не должен зависнуть.
      if (visited.has(cursor)) {
        return;
      }

      visited.add(cursor);

      const parent = await this.repository.getParentId(cursor);

      cursor = parent?.parentId ?? null;
    }
  }
}
```

- [ ] **Step 5: Запустить тесты и убедиться, что они проходят**

```bash
pnpm --filter @pnewmo/api test
```

Expected: PASS. Всего тестов — 11 из Task 5 плюс 8 из этого файла.

- [ ] **Step 6: Коммит**

```bash
git add -A
git commit -m "feat: add categories repository and service with a cycle guard

The cycle guard is the only real business rule in the module and the
reason the service layer exists. Neither Zod nor a foreign key catches
setting a category's parent to its own descendant: the request is
well-formed and the reference is valid, yet the result is a subtree
unreachable from the root that vanishes from the menu silently.

Unit-tested against a stub repository, no database involved."
```

---

### Task 7: Контроллер и e2e на весь контур

**Files:**
- Create: `apps/api/src/categories/categories.controller.ts`, `apps/api/src/categories/categories.module.ts`, `apps/api/test/categories.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `contract.categories.*` (Task 4), `CategoriesService` (Task 6), `AppExceptionFilter` (Task 5).
- Produces: работающие `GET /categories`, `GET /categories/:id`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`.

- [ ] **Step 1: Написать падающий e2e**

Create `apps/api/test/categories.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { appErrorSchema, categorySchema } from '@pnewmo/api-contract';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const categoryListSchema = z.array(categorySchema);

describe('categories', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let rootId: number;
  let leafId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Каждый тест начинает с одинакового дерева: root -> mid -> leaf.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE categories RESTART IDENTITY CASCADE');

    const root = await prisma.category.create({
      data: { name: 'Гидравлика', slug: 'gidravlika', parentId: null },
      select: { id: true },
    });
    const mid = await prisma.category.create({
      data: { name: 'Смазочная техника', slug: 'smazka', parentId: root.id },
      select: { id: true },
    });
    const leaf = await prisma.category.create({
      data: { name: 'Станции насосные', slug: 'stancii', parentId: mid.id },
      select: { id: true },
    });

    rootId = root.id;
    leafId = leaf.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('отдаёт список категорий', async () => {
    const response = await request(app.getHttpServer()).get('/categories').expect(200);
    const body = categoryListSchema.parse(response.body);

    expect(body).toHaveLength(3);
    expect(body.map((c) => c.slug)).toContain('gidravlika');
  });

  it('отдаёт категорию по идентификатору', async () => {
    const response = await request(app.getHttpServer()).get(`/categories/${rootId}`).expect(200);
    const body = categorySchema.parse(response.body);

    expect(body.slug).toBe('gidravlika');
  });

  it('возвращает 404 для неизвестного идентификатора', async () => {
    const response = await request(app.getHttpServer()).get('/categories/999999').expect(404);
    const body = appErrorSchema.parse(response.body);

    expect(body.errorCode).toBe('NOT_FOUND');
  });

  it('создаёт категорию с валидным родителем', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Питатели', slug: 'pitateli', parentId: rootId })
      .expect(201);

    const body = categorySchema.parse(response.body);

    expect(body.parentId).toBe(rootId);

    const list = await request(app.getHttpServer()).get('/categories').expect(200);

    expect(categoryListSchema.parse(list.body)).toHaveLength(4);
  });

  it('возвращает 409 на занятый slug', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Дубликат', slug: 'gidravlika', parentId: null })
      .expect(409);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('CONFLICT');
  });

  it('возвращает 400 на несуществующего родителя', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Сирота', slug: 'sirota', parentId: 999999 })
      .expect(400);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('VALIDATION_FAILED');
  });

  it('возвращает 400 и issues на slug в верхнем регистре', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Плохой слаг', slug: 'BadSlug', parentId: null })
      .expect(400);

    const body = appErrorSchema.parse(response.body);

    expect(body.errorCode).toBe('VALIDATION_FAILED');
    expect(body.issues?.length).toBeGreaterThan(0);
  });

  it('переименовывает категорию', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/categories/${rootId}`)
      .send({ name: 'Гидравлика и смазка' })
      .expect(200);

    expect(categorySchema.parse(response.body).name).toBe('Гидравлика и смазка');
  });

  it('отклоняет перенос категории в собственного потомка', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/categories/${rootId}`)
      .send({ parentId: leafId })
      .expect(400);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('VALIDATION_FAILED');
  });

  it('удаляет лист', async () => {
    const response = await request(app.getHttpServer()).delete(`/categories/${leafId}`).expect(200);

    expect(response.body).toEqual({ id: leafId });
  });

  it('возвращает 409 при удалении категории с потомками', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/categories/${rootId}`)
      .expect(409);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('CONFLICT');
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что тесты падают**

```bash
pnpm --filter @pnewmo/api test:e2e categories
```

Expected: FAIL — все запросы отдают 404, роутов ещё нет.

- [ ] **Step 3: Создать контроллер**

Create `apps/api/src/categories/categories.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { contract, type Category } from '@pnewmo/api-contract';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { CategoriesService } from './categories.service';
import { CategoryRow } from './categories.repository';

/**
 * Явный маппинг, хотя CategoryRow сейчас совпадает с DTO по форме. Смысл в
 * границе: если select в репозитории когда-нибудь расширят, лишние поля не
 * уедут клиенту автоматически.
 */
function toDto(row: CategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parentId,
    slug: row.slug,
    name: row.name,
  };
}

@Controller()
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @TsRestHandler(contract.categories.list)
  list() {
    return tsRestHandler(contract.categories.list, async () => ({
      status: 200 as const,
      body: (await this.service.getList()).map(toDto),
    }));
  }

  @TsRestHandler(contract.categories.getById)
  getById() {
    return tsRestHandler(contract.categories.getById, async ({ params }) => ({
      status: 200 as const,
      body: toDto(await this.service.getById(params.id)),
    }));
  }

  @TsRestHandler(contract.categories.create)
  create() {
    return tsRestHandler(contract.categories.create, async ({ body }) => ({
      status: 201 as const,
      body: toDto(await this.service.create(body)),
    }));
  }

  @TsRestHandler(contract.categories.update)
  update() {
    return tsRestHandler(contract.categories.update, async ({ params, body }) => ({
      status: 200 as const,
      body: toDto(await this.service.update(params.id, body)),
    }));
  }

  @TsRestHandler(contract.categories.remove)
  remove() {
    return tsRestHandler(contract.categories.remove, async ({ params }) => ({
      status: 200 as const,
      body: await this.service.remove(params.id),
    }));
  }
}
```

- [ ] **Step 4: Создать модуль и подключить его**

Create `apps/api/src/categories/categories.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
})
export class CategoriesModule {}
```

`PrismaModule` в `imports` не нужен — он глобальный. `CategoriesRepository` объявлен здесь, а не глобально: это зависимость конкретного домена.

В `apps/api/src/app.module.ts` добавить `CategoriesModule` в массив `imports`.

- [ ] **Step 5: Запустить e2e и убедиться, что они проходят**

```bash
pnpm --filter @pnewmo/api test:e2e -- categories
```

Expected: PASS, 11 тестов.

Если тест удаления категории с потомками падает с кодом, отличным от 409, — посмотреть фактический код ошибки Prisma и добавить его в `appErrorByPrismaCode`:

```bash
pnpm db:psql -c "DELETE FROM categories WHERE id = (SELECT id FROM categories WHERE parent_id IS NULL ORDER BY id LIMIT 1);" 2>&1 | head -5
```

PostgreSQL не поддерживает `LIMIT` прямо в `DELETE`, поэтому строка выбирается подзапросом. Команда должна упасть с ошибкой внешнего ключа — в её тексте и виден фактический код.

- [ ] **Step 6: Убедиться, что dev-база не затронута тестами**

E2E работают в `pnewmo_test`, и это надо подтвердить, а не предположить — иначе `TRUNCATE` в `beforeEach` однажды снесёт рабочие данные незаметно:

```bash
pnpm db:seed
pnpm db:psql -tAc "SELECT count(*) FROM categories;"
```

Expected: `40`.

- [ ] **Step 7: Проверить живой API**

```bash
pnpm --filter @pnewmo/api dev > /tmp/api.log 2>&1 &
sleep 14
echo "--- list ---"; curl -s http://localhost:4000/categories | head -c 200; echo
echo "--- count ---"; curl -s http://localhost:4000/categories | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).length))"
echo "--- create ---"; curl -s -X POST http://localhost:4000/categories -H 'Content-Type: application/json' -d '{"name":"Тестовая","slug":"testovaya","parentId":null}' -w " [%{http_code}]\n"
echo "--- duplicate ---"; curl -s -X POST http://localhost:4000/categories -H 'Content-Type: application/json' -d '{"name":"Тестовая","slug":"testovaya","parentId":null}' -w " [%{http_code}]\n"
echo "--- bad slug ---"; curl -s -X POST http://localhost:4000/categories -H 'Content-Type: application/json' -d '{"name":"Плохой","slug":"Bad Slug","parentId":null}' -w " [%{http_code}]\n"
pkill -f 'nest start'
```

Expected: список из 40 элементов; создание — 201; повтор — 409 с `errorCode: CONFLICT`; неверный slug — 400 с заполненным `issues`.

- [ ] **Step 8: Убрать тестовую категорию из dev-базы**

```bash
pnpm db:psql -c "DELETE FROM categories WHERE slug = 'testovaya';"
```

- [ ] **Step 9: Зафиксировать фактическую форму ошибки валидации**

Сравнить полученное в шаге 7 тело ответа на неверный slug с тем, что предполагает `extractTsRestIssues`. Если `issues` оказался пустым массивом, значит сериализованная ошибка Zod устроена иначе — снять фактическую форму и поправить извлечение:

```bash
pnpm --filter @pnewmo/api dev > /tmp/api.log 2>&1 &
sleep 14
curl -s -X POST http://localhost:4000/categories -H 'Content-Type: application/json' -d '{"name":"x","slug":"Bad Slug","parentId":null}' | python3 -m json.tool
pkill -f 'nest start'
```

При расхождении — поправить `extractTsRestIssues` и добавить в `error-mapping.spec.ts` тест с фактической формой.

- [ ] **Step 10: Полная проверка**

```bash
pnpm --filter @pnewmo/api test
pnpm --filter @pnewmo/api test:e2e
pnpm typecheck
pnpm build
pnpm lint; echo "lint exit: $? (1 ожидаем из-за baseline этапа 1)"
```

Expected: юнит-тесты и e2e зелёные, typecheck и build зелёные, в выводе lint нет ошибок в `apps/api` и `packages/api-contract`.

- [ ] **Step 11: Коммит**

```bash
git add -A
git commit -m "feat: serve categories CRUD over the contract

Five routes wired through tsRestHandler, so paths and response shapes
come from the contract package. Covered by eleven e2e checks against a
separate test database, each asserting the response body with the
contract's own schema rather than poking individual fields.

CategoriesRepository is declared in CategoriesModule rather than
globally: the Prisma connection is infrastructure, a domain repository
is not."
```

---

## Self-review: покрытие спека

| Требование спека | Задача |
|---|---|
| Prisma 7, зависимости, схема, `prisma.config.ts` | Task 1 |
| Модель `Category`, первая миграция | Task 1 |
| `PrismaService` с драйвер-адаптером, глобальный `PrismaModule` | Task 2 |
| Загрузка `.env` через `ConfigModule` | Task 2 |
| Тестовая база `pnewmo_test`, `globalSetup` | Task 2 |
| Сиды из категорий мока, 40 записей, глубина 5 | Task 3 |
| Пять роутов в контракте, `appErrorSchema` с `issues` | Task 4 |
| `AppError`, `AppException`, фильтр, маппинг Prisma и ts-rest | Task 5 |
| `validateResponses: true` | Task 5, Step 8 |
| Репозиторий с узким `select` | Task 6 |
| Сервис, защита от цикла, юнит-тесты | Task 6 |
| Контроллер, маппинг в DTO | Task 7 |
| Десять e2e-проверок (в плане одиннадцать: добавлена `getById` на успешный путь) | Task 7 |
| Команды `db:migrate`, `db:seed`, `db:studio`, `db:test:setup` | Task 1, Task 2 |
| Критерий «`db:studio` открывает Studio» | проверяется вручную после Task 3: `pnpm db:studio` |

## Что осознанно не делается

- Слой TanStack Query, админ-страница, перевод хедера — этап 3b.
- Модель `Product`, рекурсивный CTE в приложении, перевод `/catalog/[slug]` — этап 4.
- Авторизация, роли, `AppError.PERMISSION_DENIED`.
- Автотранслитерация `slug`, пагинация списка, мягкое удаление, `x-request-id`.
- Погашение baseline линтеров этапа 1 — отдельная согласованная задача.
