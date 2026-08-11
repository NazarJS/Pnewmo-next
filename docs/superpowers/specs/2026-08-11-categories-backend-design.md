# Этап 3a: бэкенд категорий

Дата: 2026-08-11
Ветка: `dev`
Предыдущий этап: `2026-08-11-monorepo-infra-design.md`

## Зачем

Первая настоящая таблица и первый доменный модуль. Этап закрывает бэкенд целиком: схема, миграция, сиды, пять эндпоинтов CRUD и обработка ошибок. Результат проверяется `curl` и тестами — фронтенд не требуется.

Этап 3b (слой TanStack Query, админ-страница, перевод хедера) вынесен отдельно: смешивать в одном плане незнакомую Prisma и незнакомый кеш-слой значит учить два слоя одновременно и отлаживать их взаимные ошибки.

## Объём

### Входит

1. Prisma 7 в `apps/api`: зависимости, `schema.prisma`, `prisma.config.ts`, `PrismaService`, глобальный `PrismaModule`.
2. Модель `Category`, первая миграция.
3. Сиды из категорий `db.json` — 40 записей с вложенностью до 5 уровней, идентификаторы генерирует база.
4. Пять роутов в `packages/api-contract`: `list`, `getById`, `create`, `update`, `remove`.
5. Модуль `categories` слоями: контроллер, сервис, репозиторий.
6. `AppError`, `AppException`, глобальный фильтр с маппингом ошибок Prisma и нормализацией ошибок валидации ts-rest.
7. Команды `db:migrate`, `db:seed`, `db:studio`, `db:test:setup`.
8. Тесты: e2e на весь HTTP-контур против отдельной базы, юнит-тест на защиту от цикла.

### Не входит

- Слой TanStack Query, админ-страница, перевод хедера — этап 3b.
- Модель `Product` и перевод `/catalog/[slug]` на реальный API — этап 4.
- Рекурсивный CTE. Обоснование ниже, в разделе «Дерево собирается в памяти».
- Авторизация и роли. Поэтому `AppError.PERMISSION_DENIED` не заводим — код без применения мёртв.
- Автотранслитерация `name` → `slug`. `slug` вводится руками, валидируется регуляркой. В сидах слаги уже транслитерированы в моке.

## Prisma 7: конфигурация отличается от всех туториалов

Актуальная версия — 7.9.1, Node 24 заявлен в engines (`^20.19 || ^22.12 || >=24.0`). Это мажор с переделанной конфигурацией, и материалы в сети почти целиком описывают 6.

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Три отличия от 6, каждое ломающее:

**Провайдер называется `prisma-client`, не `prisma-client-js`, и `output` обязателен.** Импорт становится явным: `import { PrismaClient } from '../generated/prisma/client'`, а не из `@prisma/client`.

**`moduleFormat = "cjs"` необходим.** По умолчанию Prisma 7 генерирует ESM, а `apps/api` компилируется в CommonJS (`module: nodenext` без `"type": "module"`). Без флага — ошибка загрузки модуля в рантайме.

**Появился `prisma.config.ts`**, заменяющий и переменную окружения в схеме, и блок `prisma.seed` в `package.json`:

```ts
// apps/api/prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env('DATABASE_URL') },
  migrations: { seed: 'tsx prisma/seed.ts' },
});
```

Раннер сидов — `tsx`, добавляется в devDependencies.

Открытый вопрос, решаемый первым шагом плана: документация Prisma 7 описывает перенос адреса базы в `prisma.config.ts` как миграцию с версии 6, но не утверждает, что блок `url = env("DATABASE_URL")` в `datasource` при этом становится лишним. Спек оставляет его в схеме (нужен CLI для миграций) и дублирует в `prisma.config.ts`; если проверка покажет конфликт — лишнее место убирается. На рантайм это не влияет: `PrismaService` передаёт адрес в конструктор явно, см. раздел про тесты.

### Куда кладётся сгенерированный клиент и почему это важно

`output = "../src/generated/prisma"` — **внутрь `src`**, плюс запись в `.gitignore`, игноры eslint и prettier.

Причина неочевидная. У `apps/api/tsconfig.json` нет `include`, поэтому TypeScript забирает все `.ts` под приложением. Файлы **вне** `src` (а `prisma.config.ts` и `prisma/seed.ts` лежат именно там) сдвигают вычисленный `rootDir` с `src` на корень приложения, и сборка выдаёт `dist/src/main.js` вместо `dist/main.js` — скрипт `start: node dist/main` перестаёт работать. Поэтому в `tsconfig.build.json` прописывается `rootDir: "./src"` явно, а генерируемый клиент живёт внутри `src`, чтобы не влиять на этот расчёт.

## Схема

```prisma
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

Решения, принятые в этапе 1 и здесь применённые: adjacency list через `parentId` без денормализованного `path`; `onDelete: Restrict` вместо каскада; таблицы и колонки в `snake_case` через `@@map`/`@map`.

`@@index([parentId])` нужен, потому что выборка потомков (`where: { parentId }`) — самый частый запрос после полного списка.

### Дерево собирается в памяти, а не рекурсивным CTE

В таблице 40 строк. Один плоский `SELECT` и сборка дерева в памяти дешевле, чем `WITH RECURSIVE` на каждый рендер меню. На фронтенде уже есть готовый `buildCategoryTree`, он остаётся в работе.

`WITH RECURSIVE` начнёт себя оправдывать в этапе 4, когда понадобится «все товары во всём поддереве категории» — там рекурсия уходит в SQL, чтобы не тащить в приложение всю таблицу товаров. Вводить её сейчас — оптимизировать запрос, которого нет.

## Сиды

Данные копируются в `apps/api/prisma/seed/categories.json`. Файл `apps/web/db.json` **не читается**: приложение не должно зависеть от файлов другого приложения, иначе удаление мока в этапе 4 сломает сиды бэкенда.

Идентификаторы **генерирует база**, мок-овые `id` не переносятся. Поля `id`, `parent_id` и `path` из мока остаются в фикстуре как входные данные — они нужны, чтобы вычислить порядок вставки и построить карту `mockId → newId`, но в базу не попадают.

Порядок вставки — по возрастанию глубины (число сегментов в `path`), иначе foreign key отвергнет ребёнка раньше родителя.

Сид идемпотентен: удаляет все категории, вставляет заново. Поскольку явные `id` не задаются, последовательность Postgres двигается штатно — известной ловушки с `setval` после вставки явных идентификаторов здесь нет.

### Инвариант — совпадение слагов, не идентификаторов

Идентификаторы через границу «Postgres ↔ json-server» не переходят. `apps/web/src/app/catalog/[slug]/page.tsx` берёт из json-server и категории, и товары, ищет категорию по `slug`, а `category.id` использует только внутри тех же мок-данных. Хедер после перевода в этапе 3b будет строить ссылки `/catalog/${slug}` из Postgres. Пока слаги совпадают, переходное состояние согласовано.

Одно следствие фиксируется как ожидаемое: категория, созданная через админку, попадёт в хедер, но страница каталога о ней не знает и отдаст «Категория не найдена». Это исчезнет в этапе 4 вместе с json-server.

## Слои модуля

```
apps/api/src/
├── prisma/
│   ├── prisma.service.ts            PrismaClient, подключение в onModuleInit
│   └── prisma.module.ts             @Global, экспортирует PrismaService
├── common/
│   ├── errors/
│   │   ├── app-error.enum.ts        AppError
│   │   └── app.exception.ts         AppException — обычный Error, без HTTP
│   └── filters/
│       └── app-exception.filter.ts  единая форма ответа для всех ошибок
└── categories/
    ├── categories.controller.ts     tsRestHandler, маппинг сущность → DTO
    ├── categories.service.ts        бизнес-правила
    ├── categories.repository.ts     только запросы Prisma
    └── categories.module.ts
```

### `PrismaModule` глобальный

Прямая аналогия с рабочим проектом `panel-administration`: там `TypeOrmModule.forRootAsync()` в `AppModule` регистрирует соединение на всё приложение, а репозитории объявляются явно в каждом модуле. Здесь так же — соединение доступно глобально, `CategoriesRepository` объявлен в `CategoriesModule`.

Тестируемость не страдает: юнит-тест сервиса подставляет фальшивый репозиторий, а не `PrismaService`, поэтому глобальность соединения на тесты не влияет.

### `AppException` не наследует `HttpException`

Обычный `Error` с полем `code: AppError`. Сервис ничего не знает про HTTP-статусы — их назначает только фильтр. Это та же граница, что «нет бизнес-логики в контроллере», но с обратной стороны: нет HTTP в домене.

### Границы слоёв

Правила из стайлгайда, применённые здесь: `PrismaService` инжектится только в репозиторий, в сервисе его нет; сущности Prisma не покидают контроллер — он маппит их в DTO контракта; whitelist полей сортировки не нужен, потому что сортировка не параметризуется (список всегда по `parentId`, затем `name`).

## Контракт

```ts
// packages/api-contract/src/category.contract.ts
export const categorySchema = z.object({
  id: z.number().int(),
  parentId: z.number().int().nullable(),
  slug: z.string(),
  name: z.string(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9_-]+$/),
  parentId: z.number().int().positive().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const appErrorSchema = z.object({
  errorCode: z.string(),
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
```

| Роут | Метод и путь | Ответы |
|---|---|---|
| `list` | `GET /categories` | 200 `Category[]` |
| `getById` | `GET /categories/:id` | 200 `Category`, 404 |
| `create` | `POST /categories` | 201 `Category`, 400, 409 |
| `update` | `PATCH /categories/:id` | 200 `Category`, 400, 404, 409 |
| `remove` | `DELETE /categories/:id` | 200 `{ id }`, 404, 409 |

`categorySchema` не содержит `createdAt` и `updatedAt`: клиенту они не нужны, а в ответе создавали бы иллюзию контракта на них. Добавим, когда появится сортировка по дате.

**`pathParams: z.object({ id: z.coerce.number().int().positive() })`** — `coerce` обязателен. Параметр пути приходит строкой, и без приведения Zod отвергнет корректный запрос как «не число».

**`remove` возвращает `200 { id }`, а не `204 No Content`.** Клиенту удобно получить идентификатор для инвалидации кеша в этапе 3b, и это снимает вопрос, как ts-rest 3.52 описывает пустое тело.

## Бизнес-правила

`list` — все категории, сортировка `parentId ASC NULLS FIRST, name ASC`. Дерево строит клиент.

`getById` — нет записи, значит `NOT_FOUND`.

`create`:
- если `parentId` задан, родитель должен существовать, иначе `VALIDATION_FAILED` (400, не 404: не найден не создаваемый объект, а ссылка во входных данных);
- уникальность `slug` обеспечивает база, нарушение приходит как `P2002` и превращается в 409.

`remove`:
- нет записи — `NOT_FOUND`;
- есть потомки — `onDelete: Restrict` даёт ошибку внешнего ключа, которая превращается в 409 с сообщением «Нельзя удалить категорию с подкатегориями».

### `update` и защита от цикла — единственная настоящая логика

Кроме проверки существования и существования нового родителя нужна защита от цикла: категорию нельзя сделать потомком самой себя или собственного потомка.

Почему это важнее, чем кажется. Присвоение `Гидравлика.parentId = Станции насосные` (её же потомок) делает целое поддерево недостижимым из корня, причём **молча**: `buildCategoryTree` не привяжет узел к корням, четыре уровня каталога исчезнут из меню, и ни одной ошибки в логах не появится. Ни Zod, ни foreign key этого не поймают — Zod видит только форму запроса, а ссылка на существующую строку с точки зрения БД корректна.

Алгоритм: подняться от нового родителя вверх по `parentId`; если встретилась обновляемая категория — цикл, `VALIDATION_FAILED`. Отдельно проверяется `parentId === id`. Глубина не превышает единиц, так что стоимость незначительна.

Это тот случай, который оправдывает существование сервисного слоя. Всё остальное в модуле — CRUD, который можно было бы отдать Prisma напрямую.

## Обработка ошибок

`AppError`: `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT`, `INTERNAL`.

Один глобальный фильтр отдаёт **единственную форму тела** (`appErrorSchema`) для всех ошибок. Порядок распознавания:

| Что поймали | Как определяем | Ответ |
|---|---|---|
| `AppException` | `instanceof` | статус по `code`: `NOT_FOUND` → 404, `VALIDATION_FAILED` → 400, `CONFLICT` → 409 |
| Известная ошибка Prisma | `PrismaClientKnownRequestError`, поле `code` | `P2002` unique → 409, `P2003` foreign key → 409, `P2025` запись не найдена → 404 |
| Провал валидации ts-rest | тело `HttpException` содержит ключи `paramsResult` / `headersResult` / `queryResult` / `bodyResult` | 400 `VALIDATION_FAILED`, Zod-issues разбираются в поле `issues` |
| Прочий `HttpException` | `instanceof` | его собственный статус, `errorCode` выводится из статуса: 400 → `VALIDATION_FAILED`, 404 → `NOT_FOUND`, 409 → `CONFLICT`, остальное → `INTERNAL` |
| Всё остальное | — | 500 `INTERNAL`, полная ошибка в лог, наружу общее сообщение |

Последняя строка обязательна: без неё наружу утекают тексты Prisma с именами таблиц и фрагментами схемы.

### Почему ошибки валидации распознаются по форме тела

`@ts-rest/nest` бросает `RequestValidationError extends BadRequestException` с телом `{ paramsResult, headersResult, queryResult, bodyResult }`, где каждое поле — либо Zod-ошибка, либо `null`. Проверено по установленному пакету 3.52.1.

Опции для замены обработчика у Nest-адаптера **нет**: `TsRestOptions` содержит только `jsonQuery`, `validateResponses`, `validateRequestHeaders`, `validateRequestQuery`, `validateRequestBody`. Аналог `requestValidationErrorHandler` есть у адаптеров Express, Fastify и serverless, но не у Nest.

Сам класс `RequestValidationError` **не экспортирован в типах** — в `index.cjs.d.ts` его нет, поэтому `instanceof` в TypeScript недоступен без небезопасного приведения. Отсюда распознавание по форме тела: оно не зависит от неэкспортированного типа и не сломается от смены имени класса.

### `validateResponses` включается

По умолчанию опция выключена. Включаем: тогда несоответствие ответа контракту даёт `ResponseValidationError extends InternalServerErrorException` с внятным сообщением, а не молча уезжает клиенту. Нарушение контракта на стороне сервера — это баг сервера, и 500 здесь честнее 200 с неправильным телом. Стоимость проверки на текущих объёмах незначительна.

## Тесты

### Отдельная база `pnewmo_test`

Прогон по dev-базе затирал бы сиды и делал тесты зависимыми от порядка. Скрипт `db:test:setup` создаёт базу в том же контейнере (`CREATE DATABASE pnewmo_test`, идемпотентно), применяет миграции и заливает сиды.

Переключение адреса базы — явное, без магии. В `apps/api/.env.example` добавляется `DATABASE_URL_TEST`. Конфиг `test/jest-e2e.json` получает `globalSetup: './setup-env.ts'`, который загружает `apps/api/.env` через `dotenv` и присваивает `process.env.DATABASE_URL = process.env.DATABASE_URL_TEST`. Дальше `PrismaService` подхватывает уже подменённое значение.

Это работает потому, что `PrismaService` передаёт адрес в конструктор явно:

```ts
super({ datasourceUrl: process.env.DATABASE_URL });
```

Явная передача выбрана вместо неявного чтения переменной генерируемым клиентом: подмена в тестах становится однострочной, и поведение не зависит от того, как именно Prisma 7 разрешает `url` между `schema.prisma` и `prisma.config.ts`.

### e2e на весь HTTP-контур

`apps/api/test/categories.e2e-spec.ts`:

| Проверка | Ожидание |
|---|---|
| `GET /categories` | 200, содержит засеянные категории, среди них корневая «Гидравлика» |
| `POST /categories` с валидным `parentId` | 201, категория появляется в списке |
| `POST /categories` с уже занятым `slug` | 409, `errorCode: CONFLICT` |
| `POST /categories` с несуществующим `parentId` | 400, `errorCode: VALIDATION_FAILED` |
| `POST /categories` со `slug` в верхнем регистре | 400, тело соответствует `appErrorSchema`, поле `issues` заполнено |
| `GET /categories/:id` с неизвестным идентификатором | 404 |
| `PATCH /categories/:id` переименование | 200, новое имя в ответе |
| `PATCH /categories/:id` с `parentId` собственного потомка | 400, цикл отклонён |
| `DELETE /categories/:id` листа | 200, `{ id }` |
| `DELETE /categories/:id` категории с потомками | 409 |

Тела ошибок проверяются разбором через `appErrorSchema` — тем же способом, что в тесте `/health`: схема контракта утверждает форму целиком, а не только те поля, которые читает тест.

### Юнит-тест на защиту от цикла

`categories.service.spec.ts` с фальшивым репозиторием, без базы. Проверяет: `parentId === id` отклоняется; `parentId` прямого потомка отклоняется; `parentId` потомка на третьем уровне отклоняется; `parentId` несвязанной категории принимается.

Это же демонстрация назначения слоя репозитория: логику можно проверить, не поднимая Postgres.

## Критерии готовности

1. `pnpm db:migrate` создаёт таблицу `categories`; `pnpm db:psql -c '\d categories'` показывает `parent_id`, `slug`, `name`, `created_at`, `updated_at` и внешний ключ на саму таблицу.
2. `pnpm db:seed` заливает 40 категорий; глубина вложенности в данных доходит до 5.
3. `curl localhost:4000/categories` отдаёт 200 и массив из 40 элементов.
4. Все десять e2e-проверок из таблицы выше проходят.
5. Юнит-тест на цикл проходит.
6. `pnpm db:studio` открывает Prisma Studio и показывает данные.
7. `pnpm typecheck`, `pnpm build`, `pnpm test` зелёные; `pnpm lint` без ошибок сверх baseline из этапа 1.
8. Создание категории через `curl` после сидов проходит без конфликта идентификаторов — последовательность корректна.
9. `git status` чист, сгенерированный клиент Prisma не попадает в индекс.

## Риски

| Риск | Обработка |
|---|---|
| `moduleFormat = "cjs"` не решает проблему загрузки при `module: nodenext` | проверяется первым шагом плана, до написания доменного кода. Обходной путь — вернуть `apps/api` на `module: commonjs` |
| Появление `prisma.config.ts` в корне приложения сдвигает `rootDir` и ломает `start: node dist/main` | явный `rootDir: "./src"` в `tsconfig.build.json`, критерий проверки — существование `dist/main.js` |
| Код ошибки Prisma при нарушении внешнего ключа на удалении отличается от `P2003` | e2e-проверка удаления родителя с потомками зафиксирует фактический код; маппинг правится по факту |
| Prisma 7 несовместима с Node 24 на практике | engines заявляет `>=24.0`; при сбое откат на Node 22, который тоже в диапазоне |
| Генерируемый клиент попадает под eslint и prettier и ломает `lint` | `src/generated` добавляется в игноры обоих инструментов и в `.gitignore` |
| Prisma 7 требует убрать `url` из `datasource` в пользу `prisma.config.ts` либо наоборот | проверяется первым шагом плана; рантайм защищён явным `datasourceUrl` в конструкторе |
| `orderBy` с `nulls: 'first'` для `parentId` не поддерживается в текущей Prisma | сортировка вынесена в один вызов репозитория; при отказе сортируется в памяти после выборки — 40 строк |

## Отложено осознанно

- **Автотранслитерация `slug`.** Нужна таблица соответствий и обработка коллизий. Форма в 3b получит поле `slug` с валидацией.
- **Пагинация `list`.** 40 строк. Появится, когда список перестанет влезать в один ответ, и вместе с ней `Pagination` из стайлгайда.
- **`x-request-id` для корреляции логов.** В рабочем проекте есть, здесь пока нет BFF и Sentry, с которыми это имеет смысл.
- **Мягкое удаление.** Категория удаляется физически. `Restrict` защищает от потери данных, а история изменений — отдельная задача.
