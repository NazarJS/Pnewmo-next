# Этап 4a: бэкенд товаров — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Завести таблицу товаров, залить в неё выгрузку Pneumax идемпотентным сидом и отдать CRUD с пагинацией по поддереву категорий.

**Architecture:** Категория получает материализованный путь (`path`) из собственных идентификаторов через точку. Выборка товаров категории идёт по префиксу пути, поэтому страница верхнего уровня показывает товары всего поддерева. Модуль `products` повторяет слои `categories`: контроллер тонкий, сервис содержит правила, репозиторий знает Prisma.

**Tech Stack:** Node 24, NestJS 11, Prisma 7 (`prisma-client` + `@prisma/adapter-pg`), PostgreSQL 16, ts-rest 3.52.1, Zod 3, Jest 30.

**Spec:** `.claude/docs/superpowers/specs/2026-08-28-products-backend-design.md`

## Global Constraints

- **Node 24.** Сначала `nvm use` — в оболочке может быть 22.
- **Prisma 7, не 6.** Генератор `prisma-client`, `output` обязателен, рантайм требует `new PrismaClient({ adapter })` вокруг `pg.Pool`. `datasourceUrl` не работает. Примеры для шестой версии не заведутся.
- **Zod пинится на 3.x**, TypeScript на 5.x. Версии не поднимать.
- **Push не выполняется.** Работа живёт в локальной ветке `dev`.
- **`@pnewmo/api` обязан линтоваться чисто** — ноль ошибок и ноль предупреждений: `pnpm --filter @pnewmo/api lint`.
- **У `@pnewmo/api-contract` линтера нет.** Ни скрипта `lint`, ни eslint-конфига; `pnpm --filter @pnewmo/api-contract lint` отвечает «None of the selected packages has a lint script» и НИЧЕГО не проверяет. Не запускай её и не отчитывайся по ней. Качество кода контракта держится на `pnpm typecheck` и ревью. Ограничение в `CLAUDE.md` про чистый линт обоих пакетов на деле выполнимо только для `@pnewmo/api` — расхождение известно, заведение линтера для контракта вынесено за рамки плана.
- `pnpm lint` в целом падает с кодом 1 — это baseline фронтенда, его не трогаем.
- **Изменения только в `apps/api` и `packages/api-contract`.** `apps/web` не трогаем — это этап 4b.
- Исходник выгрузки: `/Users/daniildalinchuk/Downloads/pneumax_pnewmatica.json`. В репозиторий не кладётся.
- Комментарии в коде — на русском, объясняют «почему», а не «что». Соответствие стилю `apps/api/src/categories/`.

---

### Task 1: Контракт товаров

**Files:**
- Create: `packages/api-contract/src/product.contract.ts`
- Modify: `packages/api-contract/src/index.ts`

**Interfaces:**
- Consumes: `appErrorSchema` из `./app-error`
- Produces: `productContract`, `productSchema`, `Product`, `CreateProductInput`, `UpdateProductInput`, `productListQuerySchema`; `contract.products.*`

`categorySchema` эта задача **не трогает**. Поле `path` добавляется в контракт вместе с его проброской в репозиторий и контроллер — одной задачей 3, после миграции. Разделять их нельзя: контракт, требующий `path`, при неизменённом `toDto` оставляет `apps/api` не компилирующимся, и все задачи между двумя правками пришлось бы принимать с красной сборкой.

- [ ] **Step 1: Создать контракт товаров**

`packages/api-contract/src/product.contract.ts`:

```ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { appErrorSchema } from './app-error';

const c = initContract();

export const productSchema = z.object({
  id: z.number().int(),
  externalId: z.string(),
  categoryId: z.number().int(),
  name: z.string(),
  imageUrl: z.string(),
  // Цена и количество ходят строками, а не числами. Prisma отдаёт Decimal, и
  // превращение его в number возвращает ту самую потерю точности, ради которой
  // Decimal и выбран: 21493.96 становится 21493.959999999999. Форматирует
  // фронтенд.
  price: z.string().nullable(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  description: z.string(),
  aiDescription: z.string(),
  specifications: z.record(z.string()),
  specificationsFull: z.record(z.string()),
});

export type Product = z.infer<typeof productSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1).max(1000),
  categoryId: z.number().int().positive(),
  imageUrl: z.string().max(2000),
  // Строка, а не число: Decimal через JSON ходит строкой, и форма ввода отдаёт
  // строку. Регулярка допускает две цифры после точки — копейки.
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Цена — число с точкой, не больше двух знаков после неё')
    .nullable(),
  specifications: z.record(z.string()).default({}),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// coerce обязателен: параметры строки запроса приходят строками, обычный
// z.number() отверг бы любой корректный запрос.
export const productListQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().gte(0).default(0),
  // Потолок в 100 — не косметика. Без него первый же обход бота с limit=100000
  // вытащит всю таблицу и сериализует её в JSON. Дефолт 24 кратен трём и
  // четырём: сетка карточек раскладывается без огрызка.
  limit: z.coerce.number().int().gt(0).max(100).default(24),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

export const productContract = c.router({
  list: {
    method: 'GET',
    path: '/products',
    query: productListQuerySchema,
    responses: {
      200: z.object({
        items: z.array(productSchema),
        total: z.number().int().gte(0),
      }),
      404: appErrorSchema,
    },
    summary: 'Товары категории с пагинацией; категория раскрывается в поддерево',
  },
  getById: {
    method: 'GET',
    path: '/products/:id',
    pathParams: idParam,
    responses: { 200: productSchema, 404: appErrorSchema },
    summary: 'Товар по идентификатору',
  },
  create: {
    method: 'POST',
    path: '/products',
    body: createProductSchema,
    responses: { 201: productSchema, 400: appErrorSchema, 409: appErrorSchema },
    summary: 'Создать товар',
  },
  update: {
    method: 'PATCH',
    path: '/products/:id',
    pathParams: idParam,
    body: updateProductSchema,
    responses: { 200: productSchema, 400: appErrorSchema, 404: appErrorSchema },
    summary: 'Изменить товар',
  },
  remove: {
    method: 'DELETE',
    path: '/products/:id',
    pathParams: idParam,
    responses: { 200: z.object({ id: z.number().int() }), 404: appErrorSchema },
    summary: 'Удалить товар',
  },
});
```

- [ ] **Step 2: Подключить в корневой роутер**

`packages/api-contract/src/index.ts`:

```ts
import { initContract } from '@ts-rest/core';

import { categoryContract } from './category.contract';
import { healthContract } from './health.contract';
import { productContract } from './product.contract';

const c = initContract();

export const contract = c.router({
  health: healthContract,
  categories: categoryContract,
  products: productContract,
});

export * from './app-error';
export * from './category.contract';
export * from './health.contract';
export * from './product.contract';
```

- [ ] **Step 3: Проверить сборку**

Run: `nvm use && pnpm --filter @pnewmo/api-contract build && pnpm typecheck`
Expected: всё зелёное. Новый роутер добавлен, но никем ещё не реализован — на типы это не влияет, `TsRestModule` не требует реализации всех маршрутов контракта.

- [ ] **Step 4: Commit**

```bash
git add packages/api-contract/src
git commit -m "feat(contract): add product routes"
```

---

### Task 2: Схема Prisma и миграция

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_products_and_category_path/migration.sql`

**Interfaces:**
- Produces: модель `Product` и поле `Category.path` в сгенерированном клиенте; таблица `products`, индексы `categories_path_key`, `categories_path_prefix_idx`, `products_specifications_idx`.

Ожидаемое временное следствие: после этой задачи `pnpm --filter @pnewmo/api test:e2e` для категорий краснеет. Существующий `categories.e2e-spec.ts` создаёт дерево напрямую через Prisma без `path`, а колонка стала обязательной. Чинится в Task 3, Step 4 — раньше нельзя, потому что чинить надо вместе с проброской поля через контракт. Проверки этой задачи ограничены схемой и SQL и e2e не запускают.

- [ ] **Step 1: Свериться с документацией Prisma 7 по классам операторов**

Через context7 (`/prisma/docs` или `/prisma/prisma`) выяснить, поддерживается ли в Prisma 7 запись `@@index([path(ops: raw("text_pattern_ops"))])` для PostgreSQL.

Это не формальность. Обычный btree-индекс по `text` в локали, отличной от `C`, **не используется** для `LIKE 'префикс%'`: индекс создан, планировщик его игнорирует, seq scan обнаруживается только под нагрузкой. Жёсткое ограничение №2 в `CLAUDE.md` прямо предупреждает, что примеры для Prisma 6 здесь не показатель.

Если поддерживается — объявить в схеме. Если нет — индекс создаётся руками в SQL миграции, а в схеме не объявляется; тогда в файл схемы добавить комментарий, что индекс живёт вне модели Prisma, иначе следующий `prisma migrate dev` покажет дрейф и предложит его удалить.

- [ ] **Step 2: Описать модели**

`apps/api/prisma/schema.prisma`, в модель `Category` добавить поле и индекс:

```prisma
model Category {
  id        Int        @id @default(autoincrement())
  parentId  Int?       @map("parent_id")
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: Restrict)
  children  Category[] @relation("CategoryTree")
  // Материализованный путь из собственных идентификаторов: «2», «2.14.87».
  // Идентификаторы, а не слаги: слаг меняется через админку, и переименование
  // ломало бы путь всему поддереву.
  path      String     @unique
  slug      String     @unique
  name      String
  products  Product[]
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  @@index([parentId])
  @@map("categories")
}

model Product {
  id                 Int      @id @default(autoincrement())
  externalId         String   @unique @map("external_id")
  categoryId         Int      @map("category_id")
  category           Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  name               String
  imageUrl           String   @map("image_url")
  price              Decimal? @db.Decimal(12, 2)
  // Дробное, а не целое: в источнике встречается «29829.6 м».
  quantity           Decimal? @db.Decimal(12, 3)
  unit               String?
  description        String   @default("")
  aiDescription      String   @default("") @map("ai_description")
  specifications     Json     @default("{}")
  specificationsFull Json     @default("{}") @map("specifications_full")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@index([categoryId])
  @@map("products")
}
```

- [ ] **Step 3: Сгенерировать миграцию**

Run: `nvm use && pnpm db:up && pnpm --filter @pnewmo/api db:migrate -- --name products_and_category_path`

- [ ] **Step 4: Дописать в миграцию обратную засыпку пути и индексы**

Prisma сгенерирует `ALTER TABLE categories ADD COLUMN path TEXT NOT NULL` — и это упадёт на существующих сорока строках. Открыть созданный `migration.sql` и заменить добавление колонки на три шага:

```sql
-- Колонка добавляется допускающей NULL: в таблице уже есть строки, и NOT NULL
-- на непустой таблице без значения по умолчанию отвергается Postgres.
ALTER TABLE "categories" ADD COLUMN "path" TEXT;

-- Обратная засыпка рекурсивным обходом от корней вниз. Нужна не ради текущих
-- сорока мок-категорий (их всё равно заменит сид), а ради того, чтобы миграция
-- была корректна на любой базе — включая ту, где кто-то успел создать
-- категории через админку.
WITH RECURSIVE tree AS (
  SELECT id, parent_id, id::text AS path
  FROM "categories"
  WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.parent_id, t.path || '.' || c.id::text
  FROM "categories" c
  JOIN tree t ON c.parent_id = t.id
)
UPDATE "categories" SET path = tree.path FROM tree WHERE "categories".id = tree.id;

ALTER TABLE "categories" ALTER COLUMN "path" SET NOT NULL;

CREATE UNIQUE INDEX "categories_path_key" ON "categories"("path");

-- Индекс под префиксный поиск. text_pattern_ops обязателен: без него btree по
-- text в русской локали не применяется к LIKE 'x.%', и выборка поддерева
-- превращается в seq scan по всей таблице.
CREATE INDEX "categories_path_prefix_idx" ON "categories" ("path" text_pattern_ops);
```

**Порядок операций важен.** Блок выше заменяет только добавление колонки `path`. Индекс по `specifications` относится к таблице `products`, поэтому его строка ставится в КОНЕЦ файла, после сгенерированного Prisma `CREATE TABLE "products"` — иначе миграция падает с «relation "products" does not exist»:

```sql
-- GIN под будущие фасетные фильтры (этап 4c). Заводится сейчас, чтобы не
-- строить индекс на живой таблице в 4842 строки потом.
CREATE INDEX "products_specifications_idx" ON "products" USING GIN ("specifications");
```

Прочитай сгенерированный файл целиком сверху вниз, прежде чем править: Prisma уже создаёт часть индексов сама, и дубль `CREATE UNIQUE INDEX categories_path_key` надо убрать, а не добавлять второй раз.

- [ ] **Step 5: Применить и проверить**

Run:
```bash
nvm use && pnpm --filter @pnewmo/api db:deploy && pnpm --filter @pnewmo/api db:generate
pnpm db:psql -c "\d categories"
pnpm db:psql -c "\d products"
```
Expected: у `categories` видны `path`, `categories_path_key`, `categories_path_prefix_idx`; таблица `products` существует с индексами по `category_id` и GIN по `specifications`.

- [ ] **Step 6: Проверить, что индекс действительно применяется**

Run:
```bash
pnpm db:psql -c "EXPLAIN SELECT id FROM categories WHERE path LIKE '1.%';"
```
Expected: в плане `Index Scan` или `Bitmap Index Scan` по `categories_path_prefix_idx`, а не `Seq Scan`.

На сорока строках планировщик может выбрать `Seq Scan` просто потому, что таблица крошечная — это нормально. Тогда проверку повторить после Task 4, когда категорий станет 222, и зафиксировать результат там.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): add products table and materialized category path"
```

---

### Task 3: Проброс `path` в категориях

**Files:**
- Modify: `packages/api-contract/src/category.contract.ts`
- Modify: `apps/api/src/categories/categories.repository.ts`
- Modify: `apps/api/src/categories/categories.controller.ts`
- Modify: `apps/api/test/categories.e2e-spec.ts`

**Interfaces:**
- Consumes: колонку `path` из Task 2
- Produces: `path` в `categorySchema` и в `CategoryRow`; `CategoriesRepository.create` возвращает категорию с рассчитанным путём

Три правки — контракт, репозиторий, контроллер — делаются одной задачей намеренно. Порознь каждая оставляет `apps/api` не компилирующимся: контракт требует поле, которого не отдаёт `toDto`. Разделение означало бы принимать промежуточные задачи с красной сборкой.

- [ ] **Step 1: Добавить `path` в схему контракта**

`packages/api-contract/src/category.contract.ts`, в `categorySchema`, после `parentId`:

```ts
export const categorySchema = z.object({
  id: z.number().int(),
  parentId: z.number().int().nullable(),
  // Материализованный путь: собственные идентификаторы через точку, «2.14.87».
  // Наружу отдаётся ради хлебных крошек — фронтенд по нему строит цепочку
  // предков, не запрашивая каждую категорию отдельно.
  path: z.string(),
  slug: z.string(),
  name: z.string(),
});
```

`createCategorySchema` и `updateCategorySchema` не трогать: путь считает сервер, клиент его не задаёт.

- [ ] **Step 2: Расширить репозиторий категорий**

`apps/api/src/categories/categories.repository.ts` — интерфейс и `columns`:

```ts
export interface CategoryRow {
  id: number;
  parentId: number | null;
  path: string;
  slug: string;
  name: string;
}

const columns = { id: true, parentId: true, path: true, slug: true, name: true } as const;
```

Метод `create` при этом ломается: `path` в базе обязателен, а вычислить его можно только после вставки, когда известен идентификатор. Заменить на транзакцию:

```ts
  /**
   * Вставка и достройка пути в одной транзакции: путь требует собственного
   * идентификатора, который известен только после INSERT, а строка с пустым
   * путём не должна быть видна другим запросам даже на мгновение.
   */
  create(data: { name: string; slug: string; parentId: number | null }): Promise<CategoryRow> {
    return this.prisma.$transaction(async (tx) => {
      const parent =
        data.parentId === null
          ? null
          : await tx.category.findUnique({ where: { id: data.parentId }, select: { path: true } });

      const created = await tx.category.create({
        data: { ...data, path: '' },
        select: { id: true },
      });

      const path = parent === null ? String(created.id) : `${parent.path}.${created.id}`;

      return tx.category.update({ where: { id: created.id }, data: { path }, select: columns });
    });
  }
```

`update` остаётся как есть: перемещение категории между родителями требует пересчёта путей всего поддерева — см. «Отложено в этом плане».

- [ ] **Step 3: Добавить `path` в маппинг контроллера**

`apps/api/src/categories/categories.controller.ts`, в `toDto`:

```ts
function toDto(row: CategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parentId,
    path: row.path,
    slug: row.slug,
    name: row.name,
  };
}
```

- [ ] **Step 4: Починить e2e категорий**

`apps/api/test/categories.e2e-spec.ts` создаёт дерево напрямую через Prisma, минуя репозиторий. После миграции `path` обязателен, и эти вставки падают. В `beforeEach` дописать путь каждой категории:

```ts
    const root = await prisma.category.create({
      data: { name: 'Гидравлика', slug: 'gidravlika', parentId: null, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: root.id }, data: { path: String(root.id) } });

    const mid = await prisma.category.create({
      data: { name: 'Смазочная техника', slug: 'smazka', parentId: root.id, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: mid.id }, data: { path: `${root.id}.${mid.id}` } });

    const leaf = await prisma.category.create({
      data: { name: 'Станции насосные', slug: 'stancii', parentId: mid.id, path: '' },
      select: { id: true },
    });
    await prisma.category.update({
      where: { id: leaf.id },
      data: { path: `${root.id}.${mid.id}.${leaf.id}` },
    });
```

Остальные тесты файла не трогать: они проверяют поведение, а не форму строки.

- [ ] **Step 5: Добавить тест на расчёт пути при создании**

В `apps/api/test/categories.e2e-spec.ts` добавить:

```ts
  it('считает путь создаваемой категории от родителя', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Новая', slug: 'novaya', parentId: rootId })
      .expect(201);

    const created = categorySchema.parse(response.body);

    expect(created.path).toBe(`${rootId}.${created.id}`);
  });

  it('у корневой категории путь равен её идентификатору', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Корневая', slug: 'kornevaya', parentId: null })
      .expect(201);

    const created = categorySchema.parse(response.body);

    expect(created.path).toBe(String(created.id));
  });
```

- [ ] **Step 6: Проверить**

Run:
```bash
nvm use && pnpm --filter @pnewmo/api-contract build && pnpm typecheck && pnpm build
pnpm --filter @pnewmo/api test:e2e -- categories
pnpm --filter @pnewmo/api lint
```
Expected: всё зелёное, включая два новых теста на путь.

- [ ] **Step 7: Commit**

```bash
git add packages/api-contract/src apps/api/src/categories apps/api/test/categories.e2e-spec.ts
git commit -m "feat(api): expose materialized category path through the contract"
```

---

### Task 4: Генератор фикстуры

**Files:**
- Create: `apps/api/prisma/seed/build-catalog-fixture.mjs`
- Create: `apps/api/prisma/seed/catalog.json` (результат работы генератора)
- Create: `apps/api/prisma/seed/build-catalog-fixture.spec.mjs` — **нет**, см. Step 1

**Interfaces:**
- Produces: файл `catalog.json` формы `{ categories: [{path, slug, name}], products: [{externalId, categoryPath, name, imageUrl, price, specifications}] }`

- [ ] **Step 1: Выделить чистые функции в отдельный модуль**

Генератор — скрипт, а не библиотека, но решения внутри него проверяемые. Чтобы их можно было протестировать, чистая логика выносится отдельно.

Create `apps/api/prisma/seed/catalog-fixture.lib.ts`:

```ts
/**
 * Чистые преобразования выгрузки. Вынесены из скрипта ради тестов: решения о
 * качестве данных (что мусор, какой товар считать дублем) — предмет проверки,
 * а чтение файла и запись результата — нет.
 */

/** Метаданные CMS, попавшие в характеристики по недосмотру источника. */
export const JUNK_SPEC_KEYS = new Set([
  'Рейтинг',
  'Сумма оценок',
  'Количество проголосовавших',
  'Название для 2GIS',
  'Текст Alt Картинке',
]);

export interface SourceProduct {
  id: string;
  fullTitle: string;
  image: string;
  price: string;
  characteristics: { short?: Record<string, string>; full?: Record<string, string> };
}

export interface SourceCategory {
  name: string;
  url: string;
  products?: SourceProduct[];
  subcategories?: SourceCategory[];
}

export interface FixtureCategory {
  path: string;
  slug: string;
  name: string;
}

export interface FixtureProduct {
  externalId: string;
  categoryPath: string;
  name: string;
  imageUrl: string;
  price: number | null;
  specifications: Record<string, string>;
}

/** Слаг — последний сегмент url категории. Все 222 уникальны, проверено. */
export function slugFromUrl(url: string): string {
  const parts = url.split('/').filter(Boolean);

  return parts[parts.length - 1] ?? '';
}

/**
 * Цена в источнике — строка вида «21 493.96 ₽» с неразрывными пробелами.
 * Возвращает null, а не 0, когда разобрать не удалось: ноль означает
 * «бесплатно», а не «неизвестно».
 */
export function parsePrice(raw: string): number | null {
  const digits = raw.replace(/[^\d.,]/g, '').replace(',', '.');

  if (digits === '') {
    return null;
  }

  const value = Number(digits);

  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

export function cleanSpecifications(short: Record<string, string> | undefined): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(short ?? {})) {
    if (!JUNK_SPEC_KEYS.has(key)) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Обход дерева в глубину. Путь позиционный — он лишь задаёт структуру и
 * порядок вставки, настоящие пути из идентификаторов базы считает сид.
 *
 * Дубли externalId схлопываются: побеждает первое вхождение. В источнике их 20
 * из 4862 — один товар лежит в двух категориях. Честной моделью была бы связь
 * многие-ко-многим, но она добавляет таблицу и усложняет подсчёт total ради
 * 0.4% записей.
 */
export function flatten(root: SourceCategory): {
  categories: FixtureCategory[];
  products: FixtureProduct[];
} {
  const categories: FixtureCategory[] = [];
  const products: FixtureProduct[] = [];
  const seen = new Set<string>();

  const walk = (node: SourceCategory, parentPath: string): void => {
    const path = parentPath === '' ? String(categories.length + 1) : `${parentPath}.${categories.length + 1}`;

    categories.push({ path, slug: slugFromUrl(node.url), name: node.name });

    for (const product of node.products ?? []) {
      if (seen.has(product.id)) {
        continue;
      }

      seen.add(product.id);

      products.push({
        externalId: product.id,
        categoryPath: path,
        // fullTitle, а не title: title всегда битая склейка короткого названия
        // с fullTitle без разделителя, «…ISO 155521391.63.0125.01 - Цилиндр…».
        // Границу склейки восстановить нельзя, а fullTitle содержит всё.
        name: product.fullTitle,
        imageUrl: product.image,
        price: parsePrice(product.price),
        specifications: cleanSpecifications(product.characteristics?.short),
      });
    }

    for (const child of node.subcategories ?? []) {
      walk(child, path);
    }
  };

  walk(root, '');

  return { categories, products };
}
```

- [ ] **Step 2: Написать падающие тесты**

Create `apps/api/prisma/seed/catalog-fixture.lib.spec.ts`:

```ts
import { cleanSpecifications, flatten, parsePrice, slugFromUrl, SourceCategory } from './catalog-fixture.lib';

describe('slugFromUrl', () => {
  it('берёт последний сегмент', () => {
    expect(slugFromUrl('https://pneumax.ru/catalog/pnevmatika/')).toBe('pnevmatika');
  });
});

describe('parsePrice', () => {
  it('разбирает цену с пробелами и рублём', () => {
    expect(parsePrice('21 493.96 ₽')).toBe(21493.96);
  });

  it('пустую цену превращает в null, а не в ноль', () => {
    expect(parsePrice('')).toBeNull();
  });

  it('неразбираемую цену превращает в null', () => {
    expect(parsePrice('по запросу')).toBeNull();
  });
});

describe('cleanSpecifications', () => {
  it('выбрасывает метаданные CMS и оставляет свойства товара', () => {
    const result = cleanSpecifications({
      'Диаметр поршня, мм': '63',
      Рейтинг: '3.3',
      'Сумма оценок': '5',
      'Количество проголосовавших': '1',
      'Название для 2GIS': 'Цилиндр',
      'Текст Alt Картинке': 'фото',
    });

    expect(result).toEqual({ 'Диаметр поршня, мм': '63' });
  });

  it('переживает отсутствие характеристик', () => {
    expect(cleanSpecifications(undefined)).toEqual({});
  });
});

describe('flatten', () => {
  const tree: SourceCategory = {
    name: 'Корень',
    url: 'https://x/catalog/root/',
    products: [],
    subcategories: [
      {
        name: 'Ветка',
        url: 'https://x/catalog/branch/',
        products: [
          {
            id: '1',
            fullTitle: 'Товар А',
            image: 'a.webp',
            price: '10 ₽',
            characteristics: { short: { Серия: '1390' } },
          },
        ],
        subcategories: [
          {
            name: 'Лист',
            url: 'https://x/catalog/leaf/',
            products: [
              {
                id: '1',
                fullTitle: 'Товар А снова',
                image: 'a2.webp',
                price: '20 ₽',
                characteristics: { short: {} },
              },
              {
                id: '2',
                fullTitle: 'Товар Б',
                image: 'b.webp',
                price: '30 ₽',
                characteristics: { short: {} },
              },
            ],
          },
        ],
      },
    ],
  };

  it('строит путь из позиций в дереве', () => {
    const { categories } = flatten(tree);

    expect(categories.map((c) => c.path)).toEqual(['1', '1.2', '1.2.3']);
    expect(categories.map((c) => c.slug)).toEqual(['root', 'branch', 'leaf']);
  });

  it('схлопывает дубли externalId, оставляя первое вхождение', () => {
    const { products } = flatten(tree);

    expect(products.map((p) => p.externalId)).toEqual(['1', '2']);
    expect(products[0].name).toBe('Товар А');
    expect(products[0].categoryPath).toBe('1.2');
  });
});
```

- [ ] **Step 3: Запустить тесты и убедиться, что падают**

Run: `nvm use && pnpm --filter @pnewmo/api test -- catalog-fixture`
Expected: FAIL — модуль не найден или функции не определены.

Тесты лежат в `prisma/`, а jest в `apps/api/package.json` настроен на `"rootDir": "src"`. Расширить `roots`:

```json
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "roots": ["<rootDir>/src", "<rootDir>/prisma"],
  "testRegex": ".*\\.spec\\.ts$",
  ...
  "coverageDirectory": "./coverage",
}
```

Внимание: смена `rootDir` с `"src"` на `"."` требует поправить `coverageDirectory` с `"../coverage"` на `"./coverage"`, иначе покрытие уедет на уровень выше, в корень монорепо.

- [ ] **Step 4: Реализовать `catalog-fixture.lib.ts`**

Код целиком приведён в Step 1.

- [ ] **Step 5: Запустить тесты и убедиться, что проходят**

Run: `nvm use && pnpm --filter @pnewmo/api test -- catalog-fixture`
Expected: PASS, 8 тестов.

- [ ] **Step 6: Написать скрипт-обёртку**

Create `apps/api/prisma/seed/build-catalog-fixture.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { flatten, SourceCategory } from './catalog-fixture.lib';

/**
 * Пересборка фикстуры каталога из выгрузки.
 *
 *   pnpm --filter @pnewmo/api catalog:fixture -- ~/Downloads/pneumax_pnewmatica.json
 *
 * Скрипт коммитится вместе с результатом. Без него фикстура становится
 * артефактом, который «однажды сконвертировали», и пересобрать её из новой
 * выгрузки не сможет никто, кроме автора.
 */
function main(): void {
  const source = process.argv[2];

  if (!source) {
    throw new Error('Укажите путь к выгрузке: catalog:fixture -- <путь к json>');
  }

  const root = JSON.parse(readFileSync(source, 'utf8')) as SourceCategory;

  // В выгрузке корень назван «Гидравлика», хотя его url — /catalog/pnevmatika/,
  // а все шесть детей пневматические. Это ошибка источника. Правка стоит здесь
  // отдельной заметной строкой, а не прячется в данных: если следующая выгрузка
  // приедет исправленной, строку надо будет снять.
  root.name = 'Пневматика';

  const fixture = flatten(root);
  const target = join(__dirname, 'catalog.json');

  writeFileSync(target, JSON.stringify(fixture), 'utf8');

  console.log(
    `fixture: ${fixture.categories.length} categories, ${fixture.products.length} products -> ${target}`,
  );
}

main();
```

Добавить в `apps/api/package.json` в `scripts`:

```json
"catalog:fixture": "tsx prisma/seed/build-catalog-fixture.ts"
```

- [ ] **Step 7: Собрать фикстуру и проверить цифры**

Run:
```bash
nvm use
pnpm --filter @pnewmo/api catalog:fixture -- /Users/daniildalinchuk/Downloads/pneumax_pnewmatica.json
node -e "const f=require('./apps/api/prisma/seed/catalog.json');console.log('categories',f.categories.length,'products',f.products.length,'root',f.categories[0].name,f.categories[0].slug,'keys',new Set(f.products.flatMap(p=>Object.keys(p.specifications))).size)"
ls -lh apps/api/prisma/seed/catalog.json
```
Expected: `categories 222 products 4842 root Пневматика pnevmatika keys 34`, размер около 2.75 МБ.

Если числа разошлись — остановиться и разобраться, а не подгонять. Расхождение означает, что выгрузка не та, на которой делались замеры в спеке.

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/seed apps/api/package.json
git commit -m "feat(api): add catalog fixture generator and fixture"
```

---

### Task 5: Идемпотентный сид

**Files:**
- Modify: `apps/api/prisma/seed.ts` (переписывается целиком)
- Create: `apps/api/prisma/seed/seed.lib.ts`
- Create: `apps/api/prisma/seed/seed.lib.spec.ts`
- Delete: `apps/api/prisma/seed/categories.json`
- Modify: `apps/api/package.json`, корневой `package.json`

**Interfaces:**
- Consumes: `catalog.json` из Task 3
- Produces: `buildInsertOrder(categories)`, `computePath(parentPath, id)`; команды `db:seed`, `db:seed:reset`

- [ ] **Step 1: Написать падающие тесты на чистую логику сида**

Create `apps/api/prisma/seed/seed.lib.spec.ts`:

```ts
import { buildInsertOrder, computePath, depthOf } from './seed.lib';

describe('depthOf', () => {
  it('считает глубину по числу сегментов пути', () => {
    expect(depthOf('1')).toBe(1);
    expect(depthOf('1.2.3')).toBe(3);
  });
});

describe('buildInsertOrder', () => {
  it('сортирует категории по возрастанию глубины', () => {
    const ordered = buildInsertOrder([
      { path: '1.2.3', slug: 'c', name: 'C' },
      { path: '1', slug: 'a', name: 'A' },
      { path: '1.2', slug: 'b', name: 'B' },
    ]);

    expect(ordered.map((c) => c.path)).toEqual(['1', '1.2', '1.2.3']);
  });

  it('не переставляет категории одной глубины', () => {
    const ordered = buildInsertOrder([
      { path: '2', slug: 'b', name: 'B' },
      { path: '1', slug: 'a', name: 'A' },
    ]);

    expect(ordered.map((c) => c.path)).toEqual(['2', '1']);
  });
});

describe('computePath', () => {
  it('у корня путь равен идентификатору', () => {
    expect(computePath(null, 7)).toBe('7');
  });

  it('у потомка путь равен пути родителя плюс собственный идентификатор', () => {
    expect(computePath('2.14', 87)).toBe('2.14.87');
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падают**

Run: `nvm use && pnpm --filter @pnewmo/api test -- seed.lib`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `seed.lib.ts`**

Create `apps/api/prisma/seed/seed.lib.ts`:

```ts
import { FixtureCategory } from './catalog-fixture.lib';

export function depthOf(path: string): number {
  return path.split('.').length;
}

/**
 * Порядок вставки — по возрастанию глубины: внешний ключ требует, чтобы
 * родитель уже существовал. Сортировка устойчивая, поэтому порядок категорий
 * одного уровня сохраняется как в фикстуре, и идентификаторы между прогонами
 * получаются предсказуемыми.
 */
export function buildInsertOrder(categories: FixtureCategory[]): FixtureCategory[] {
  return [...categories].sort((a, b) => depthOf(a.path) - depthOf(b.path));
}

/**
 * Настоящий путь считается из идентификаторов базы, а не из позиционных путей
 * фикстуры: позиционные нужны лишь чтобы связать родителя с потомком при
 * загрузке.
 */
export function computePath(parentPath: string | null, id: number): string {
  return parentPath === null ? String(id) : `${parentPath}.${id}`;
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что проходят**

Run: `nvm use && pnpm --filter @pnewmo/api test -- seed.lib`
Expected: PASS, 5 тестов.

- [ ] **Step 5: Переписать `seed.ts`**

Replace `apps/api/prisma/seed.ts` целиком:

```ts
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { FixtureCategory, FixtureProduct } from './seed/catalog-fixture.lib';
import { buildInsertOrder, computePath } from './seed/seed.lib';

interface Fixture {
  categories: FixtureCategory[];
  products: FixtureProduct[];
}

/** Вставка товаров пачками: 4842 отдельных запроса — это минуты вместо секунд. */
const BATCH_SIZE = 500;

function loadFixture(): Fixture {
  return JSON.parse(readFileSync(join(__dirname, 'seed', 'catalog.json'), 'utf8')) as Fixture;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL не задан');
  }

  const force = process.argv.includes('--force');
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const existing = await prisma.product.count();

    // Сторожевое условие. Требование звучало как «залить один раз у всех,
    // дальше не трогать»: сид вызывается на каждом `pnpm dev`, но работает
    // ровно однажды — на пустой таблице сразу после миграции.
    //
    // Следствие, и оно желаемое: как только через админку создадут первый
    // товар, сид не сработает больше никогда и не сможет затереть введённое
    // руками.
    if (existing > 0 && !force) {
      console.log(`seed: пропущено, в базе уже ${existing} товаров (--force для перезаливки)`);

      return;
    }

    // TRUNCATE, а не deleteMany: onDelete Restrict проверяется немедленно на
    // каждой строке, поэтому массовое удаление самоссылающейся таблицы падает в
    // зависимости от порядка строк. CASCADE снимает товары вместе с категориями.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE categories, products RESTART IDENTITY CASCADE');

    const fixture = loadFixture();
    // Позиционный путь фикстуры -> идентификатор и настоящий путь в базе.
    const inserted = new Map<string, { id: number; path: string }>();

    for (const category of buildInsertOrder(fixture.categories)) {
      const segments = category.path.split('.');
      const parentFixturePath = segments.slice(0, -1).join('.');
      const parent = parentFixturePath === '' ? null : inserted.get(parentFixturePath);

      if (parentFixturePath !== '' && parent === undefined) {
        throw new Error(
          `Родитель ${parentFixturePath} категории ${category.path} ещё не вставлен — проверьте порядок в фикстуре`,
        );
      }

      const created = await prisma.category.create({
        data: {
          name: category.name,
          slug: category.slug,
          parentId: parent?.id ?? null,
          // Временное значение: настоящий путь требует собственного
          // идентификатора, который известен только после вставки.
          //
          // Колонка `path` уникальна, и держится этот приём исключительно на
          // последовательности цикла: каждая итерация проставляет настоящий
          // путь до того, как вставится следующая строка, поэтому двух пустых
          // значений одновременно не бывает. Переделка на пакетную вставку
          // (`createMany`) сломает инвариант — один INSERT с несколькими
          // пустыми путями упадёт на уникальном индексе. Упадёт громко, но
          // знать об этом надо заранее.
          path: '',
        },
        select: { id: true },
      });

      const path = computePath(parent?.path ?? null, created.id);

      await prisma.category.update({ where: { id: created.id }, data: { path } });

      inserted.set(category.path, { id: created.id, path });
    }

    let done = 0;

    for (let i = 0; i < fixture.products.length; i += BATCH_SIZE) {
      const batch = fixture.products.slice(i, i + BATCH_SIZE).map((product) => {
        const category = inserted.get(product.categoryPath);

        if (category === undefined) {
          throw new Error(`Категория ${product.categoryPath} товара ${product.externalId} не найдена`);
        }

        return {
          externalId: product.externalId,
          categoryId: category.id,
          name: product.name,
          imageUrl: product.imageUrl,
          price: product.price,
          specifications: product.specifications,
        };
      });

      await prisma.product.createMany({ data: batch });
      done += batch.length;
    }

    console.log(`seeded ${inserted.size} categories, ${done} products`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
```

- [ ] **Step 6: Удалить старую фикстуру и подключить команды**

```bash
git rm apps/api/prisma/seed/categories.json
```

В `apps/api/package.json`:

```json
"db:seed:reset": "prisma db seed -- --force"
```

В корневом `package.json` заменить строку `dev`:

```json
"dev": "pnpm db:up && pnpm db:sync && pnpm db:seed && turbo run dev mock",
"db:seed:reset": "pnpm --filter @pnewmo/api db:seed:reset",
```

Таска `mock` пока остаётся: `json-server` выключается этапом 4b, и до его завершения витрина на нём живёт.

- [ ] **Step 7: Проверить сид на чистой базе**

Run:
```bash
nvm use && pnpm db:reset && pnpm db:up && pnpm --filter @pnewmo/api db:deploy && pnpm db:seed
```
Expected: `seeded 222 categories, 4842 products`.

- [ ] **Step 8: Проверить идемпотентность**

Run: `pnpm db:seed`
Expected: `seed: пропущено, в базе уже 4842 товаров (--force для перезаливки)`.

Run:
```bash
pnpm db:psql -c "SELECT count(*) FROM products;"
pnpm db:psql -c "SELECT path, name FROM categories ORDER BY length(path), path LIMIT 8;"
pnpm db:psql -c "EXPLAIN SELECT id FROM categories WHERE path LIKE '1.%';"
```
Expected: 4842 товара; у корня путь равен его идентификатору, у детей — путь родителя плюс свой id; в плане запроса `Index Scan` по `categories_path_prefix_idx`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma apps/api/package.json package.json
git commit -m "feat(api): seed catalog from fixture, idempotent by guard"
```

---

### Task 6: Репозиторий и сервис товаров

**Files:**
- Create: `apps/api/src/products/products.repository.ts`
- Create: `apps/api/src/products/products.service.ts`
- Create: `apps/api/src/products/products.service.spec.ts`
- Modify: `apps/api/src/categories/categories.repository.ts` (добавить `path` в `columns` и `CategoryRow`)

**Interfaces:**
- Consumes: `PrismaService`, `AppException`, `AppError`
- Produces: `ProductRow`, `ProductsRepository` (`getList`, `getById`, `getCategoryPath`, `create`, `update`, `remove`), `ProductsService` (`getList`, `getById`, `create`, `update`, `remove`)

- [ ] **Step 1: Написать падающие тесты сервиса**

Create `apps/api/src/products/products.service.spec.ts`:

```ts
import { AppError } from '../common/errors/app-error.enum';
import { AppException } from '../common/errors/app.exception';
import { ProductRow, ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

/**
 * Дерево категорий:
 *   1 «Пневматика»              путь «1»          товаров нет
 *     └ 2 «Цилиндры»            путь «1.2»        товар 10
 *         └ 3 «ISO 15552»       путь «1.2.3»      товар 11
 *   4 «Фитинги»                 путь «4»          товар 12
 *
 * Проверяемое поведение: запрос по категории 1 обязан вернуть товары 10 и 11
 * и не вернуть 12.
 */
const rows: ProductRow[] = [
  { id: 10, externalId: 'a', categoryId: 2, name: 'Цилиндр', imageUrl: 'a.webp', price: '100.00', quantity: null, unit: null, description: '', aiDescription: '', specifications: {}, specificationsFull: {} },
  { id: 11, externalId: 'b', categoryId: 3, name: 'Цилиндр ISO', imageUrl: 'b.webp', price: null, quantity: null, unit: null, description: '', aiDescription: '', specifications: {}, specificationsFull: {} },
  { id: 12, externalId: 'c', categoryId: 4, name: 'Фитинг', imageUrl: 'c.webp', price: '5.50', quantity: null, unit: null, description: '', aiDescription: '', specifications: {}, specificationsFull: {} },
];

const paths = new Map<number, string>([
  [1, '1'],
  [2, '1.2'],
  [3, '1.2.3'],
  [4, '4'],
]);

type RepositoryStub = Pick<
  ProductsRepository,
  'getList' | 'getById' | 'getCategoryPath' | 'create' | 'update' | 'remove'
>;

function makeRepository(): ProductsRepository {
  const stub: RepositoryStub = {
    getCategoryPath: (id) => Promise.resolve(paths.has(id) ? { path: paths.get(id)! } : null),
    getList: ({ pathPrefix, offset, limit }) => {
      const matched =
        pathPrefix === undefined
          ? rows
          : rows.filter((row) => {
              const path = paths.get(row.categoryId) ?? '';

              return path === pathPrefix || path.startsWith(`${pathPrefix}.`);
            });

      return Promise.resolve({ items: matched.slice(offset, offset + limit), total: matched.length });
    },
    getById: (id) => Promise.resolve(rows.find((row) => row.id === id) ?? null),
    create: () => Promise.resolve(rows[0]),
    update: () => Promise.resolve(rows[0]),
    remove: () => Promise.resolve(rows[0]),
  };

  return stub as ProductsRepository;
}

describe('ProductsService.getList', () => {
  it('возвращает товары всего поддерева, включая собственные товары категории', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ categoryId: 2, offset: 0, limit: 24 });

    expect(result.items.map((item) => item.id)).toEqual([10, 11]);
    expect(result.total).toBe(2);
  });

  it('от корня отдаёт товары всех потомков', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ categoryId: 1, offset: 0, limit: 24 });

    expect(result.items.map((item) => item.id)).toEqual([10, 11]);
  });

  it('не подмешивает товары соседней ветки', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ categoryId: 1, offset: 0, limit: 24 });

    expect(result.items.map((item) => item.id)).not.toContain(12);
  });

  it('без категории отдаёт весь каталог', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ offset: 0, limit: 24 });

    expect(result.total).toBe(3);
  });

  it('на несуществующей категории бросает NOT_FOUND, а не пустой список', async () => {
    const service = new ProductsService(makeRepository());

    await expect(service.getList({ categoryId: 999, offset: 0, limit: 24 })).rejects.toMatchObject({
      error: AppError.NOT_FOUND,
    });
  });

  it('total не зависит от размера страницы', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ categoryId: 1, offset: 0, limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(2);
  });
});

describe('ProductsService.getById', () => {
  it('бросает NOT_FOUND на отсутствующем товаре', async () => {
    const service = new ProductsService(makeRepository());

    await expect(service.getById(404)).rejects.toBeInstanceOf(AppException);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падают**

Run: `nvm use && pnpm --filter @pnewmo/api test -- products.service`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Реализовать репозиторий**

Create `apps/api/src/products/products.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface ProductRow {
  id: number;
  externalId: string;
  categoryId: number;
  name: string;
  imageUrl: string;
  price: string | null;
  quantity: string | null;
  unit: string | null;
  description: string;
  aiDescription: string;
  specifications: Record<string, string>;
  specificationsFull: Record<string, string>;
}

export interface ListParams {
  pathPrefix?: string;
  offset: number;
  limit: number;
}

const columns = {
  id: true,
  externalId: true,
  categoryId: true,
  name: true,
  imageUrl: true,
  price: true,
  quantity: true,
  unit: true,
  description: true,
  aiDescription: true,
  specifications: true,
  specificationsFull: true,
} as const;

type RawRow = {
  price: unknown;
  quantity: unknown;
  specifications: unknown;
  specificationsFull: unknown;
} & Omit<ProductRow, 'price' | 'quantity' | 'specifications' | 'specificationsFull'>;

/**
 * Decimal и Json из Prisma приводятся к форме контракта здесь, а не в
 * контроллере: наружу из репозитория должен выходить обычный объект, иначе
 * Decimal утечёт в сервис и однажды попадёт в арифметику.
 */
function toRow(raw: RawRow): ProductRow {
  return {
    ...raw,
    price: raw.price === null ? null : String(raw.price),
    quantity: raw.quantity === null ? null : String(raw.quantity),
    specifications: (raw.specifications ?? {}) as Record<string, string>,
    specificationsFull: (raw.specificationsFull ?? {}) as Record<string, string>,
  };
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  getCategoryPath(id: number): Promise<{ path: string } | null> {
    return this.prisma.category.findUnique({ where: { id }, select: { path: true } });
  }

  /**
   * Список и счётчик в одной транзакции. Порознь между ними может пройти
   * вставка, и total разойдётся со страницей — на глаз это выглядит как
   * исчезающий последний товар.
   */
  async getList({ pathPrefix, offset, limit }: ListParams): Promise<{ items: ProductRow[]; total: number }> {
    // Условие берёт и саму категорию, и потомков. Без первой половины страница
    // категории теряла бы её собственные товары.
    const where =
      pathPrefix === undefined
        ? {}
        : { category: { OR: [{ path: pathPrefix }, { path: { startsWith: `${pathPrefix}.` } }] } };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, select: columns, orderBy: { id: 'asc' }, skip: offset, take: limit }),
      this.prisma.product.count({ where }),
    ]);

    return { items: items.map((item) => toRow(item as RawRow)), total };
  }

  async getById(id: number): Promise<ProductRow | null> {
    const found = await this.prisma.product.findUnique({ where: { id }, select: columns });

    return found === null ? null : toRow(found as RawRow);
  }

  async create(data: {
    name: string;
    categoryId: number;
    imageUrl: string;
    price: string | null;
    specifications: Record<string, string>;
  }): Promise<ProductRow> {
    const created = await this.prisma.product.create({
      data: { ...data, externalId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      select: columns,
    });

    return toRow(created as RawRow);
  }

  async update(
    id: number,
    data: {
      name?: string;
      categoryId?: number;
      imageUrl?: string;
      price?: string | null;
      specifications?: Record<string, string>;
    },
  ): Promise<ProductRow> {
    const updated = await this.prisma.product.update({ where: { id }, data, select: columns });

    return toRow(updated as RawRow);
  }

  async remove(id: number): Promise<ProductRow> {
    const removed = await this.prisma.product.delete({ where: { id }, select: columns });

    return toRow(removed as RawRow);
  }
}
```

- [ ] **Step 4: Реализовать сервис**

Create `apps/api/src/products/products.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.enum';
import { AppException } from '../common/errors/app.exception';
import { ProductRow, ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}

  async getList(params: { categoryId?: number; offset: number; limit: number }): Promise<{
    items: ProductRow[];
    total: number;
  }> {
    let pathPrefix: string | undefined;

    if (params.categoryId !== undefined) {
      const category = await this.repository.getCategoryPath(params.categoryId);

      // NOT_FOUND, а не пустой список: запрос к несуществующей категории — это
      // ошибка клиента, и молчаливый пустой ответ её прячет. Опечатка в ссылке
      // выглядела бы как «в категории нет товаров».
      if (!category) {
        throw new AppException(AppError.NOT_FOUND, `Категория ${params.categoryId} не найдена`);
      }

      pathPrefix = category.path;
    }

    return this.repository.getList({ pathPrefix, offset: params.offset, limit: params.limit });
  }

  async getById(id: number): Promise<ProductRow> {
    const product = await this.repository.getById(id);

    if (!product) {
      throw new AppException(AppError.NOT_FOUND, `Товар ${id} не найден`);
    }

    return product;
  }

  async create(data: {
    name: string;
    categoryId: number;
    imageUrl: string;
    price: string | null;
    specifications: Record<string, string>;
  }): Promise<ProductRow> {
    await this.assertCategoryExists(data.categoryId);

    return this.repository.create(data);
  }

  async update(
    id: number,
    data: {
      name?: string;
      categoryId?: number;
      imageUrl?: string;
      price?: string | null;
      specifications?: Record<string, string>;
    },
  ): Promise<ProductRow> {
    await this.getById(id);

    if (data.categoryId !== undefined) {
      await this.assertCategoryExists(data.categoryId);
    }

    return this.repository.update(id, data);
  }

  async remove(id: number): Promise<{ id: number }> {
    await this.getById(id);

    const removed = await this.repository.remove(id);

    return { id: removed.id };
  }

  /**
   * VALIDATION_FAILED, а не NOT_FOUND: не найден не создаваемый объект, а
   * ссылка во входных данных. То же решение, что в CategoriesService.
   */
  private async assertCategoryExists(categoryId: number): Promise<void> {
    const category = await this.repository.getCategoryPath(categoryId);

    if (!category) {
      throw new AppException(AppError.VALIDATION_FAILED, `Категория ${categoryId} не найдена`);
    }
  }
}
```

- [ ] **Step 5: Запустить тесты**

Run: `nvm use && pnpm --filter @pnewmo/api test -- products.service`
Expected: PASS, 7 тестов.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/products apps/api/src/categories/categories.repository.ts
git commit -m "feat(api): add products repository and service with subtree lookup"
```

---

### Task 7: Контроллер, модуль и e2e

**Files:**
- Create: `apps/api/src/products/products.controller.ts`
- Create: `apps/api/src/products/products.module.ts`
- Create: `apps/api/test/products.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/categories/categories.controller.ts` (добавить `path` в `toDto`)

**Interfaces:**
- Consumes: `ProductsService`, `contract.products`
- Produces: HTTP-эндпоинты `/products`

- [ ] **Step 1: Написать e2e-тесты**

Create `apps/api/test/products.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { productSchema } from '@pnewmo/api-contract';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const listSchema = z.object({ items: z.array(productSchema), total: z.number().int().gte(0) });

describe('products', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let rootId: number;
  let midId: number;
  let siblingId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE categories, products RESTART IDENTITY CASCADE');

    // Дерево: root -> mid; отдельно sibling. Товары висят на mid и sibling.
    const root = await prisma.category.create({
      data: { name: 'Пневматика', slug: 'pnevmatika', parentId: null, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: root.id }, data: { path: String(root.id) } });

    const mid = await prisma.category.create({
      data: { name: 'Цилиндры', slug: 'cilindry', parentId: root.id, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: mid.id }, data: { path: `${root.id}.${mid.id}` } });

    const sibling = await prisma.category.create({
      data: { name: 'Фитинги', slug: 'fitingi', parentId: null, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: sibling.id }, data: { path: String(sibling.id) } });

    await prisma.product.createMany({
      data: [
        { externalId: 'p1', categoryId: mid.id, name: 'Цилиндр 1', imageUrl: 'a.webp', price: '100.00' },
        { externalId: 'p2', categoryId: mid.id, name: 'Цилиндр 2', imageUrl: 'b.webp', price: '200.00' },
        { externalId: 'p3', categoryId: sibling.id, name: 'Фитинг', imageUrl: 'c.webp', price: null },
      ],
    });

    rootId = root.id;
    midId = mid.id;
    siblingId = sibling.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('от корня отдаёт товары поддерева и не отдаёт соседнюю ветку', async () => {
    const response = await request(app.getHttpServer()).get(`/products?categoryId=${rootId}`).expect(200);
    const body = listSchema.parse(response.body);

    expect(body.total).toBe(2);
    expect(body.items.map((item) => item.name)).toEqual(['Цилиндр 1', 'Цилиндр 2']);
  });

  it('без категории отдаёт весь каталог', async () => {
    const response = await request(app.getHttpServer()).get('/products').expect(200);

    expect(listSchema.parse(response.body).total).toBe(3);
  });

  it('total не зависит от limit', async () => {
    const response = await request(app.getHttpServer()).get(`/products?categoryId=${rootId}&limit=1`).expect(200);
    const body = listSchema.parse(response.body);

    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(2);
  });

  it('offset сдвигает окно', async () => {
    const response = await request(app.getHttpServer())
      .get(`/products?categoryId=${rootId}&offset=1&limit=1`)
      .expect(200);

    expect(listSchema.parse(response.body).items[0].name).toBe('Цилиндр 2');
  });

  it('отвергает limit больше сотни', async () => {
    await request(app.getHttpServer()).get('/products?limit=100000').expect(400);
  });

  it('на несуществующей категории отвечает 404', async () => {
    await request(app.getHttpServer()).get('/products?categoryId=999999').expect(404);
  });

  it('отдаёт цену строкой без потери копеек', async () => {
    const response = await request(app.getHttpServer()).get(`/products?categoryId=${midId}`).expect(200);

    expect(listSchema.parse(response.body).items[0].price).toBe('100.00');
  });

  it('создаёт товар', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Новый', categoryId: siblingId, imageUrl: 'n.webp', price: '9.99', specifications: {} })
      .expect(201);

    expect(productSchema.parse(response.body).name).toBe('Новый');
  });

  it('отвергает создание в несуществующей категории', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Новый', categoryId: 999999, imageUrl: 'n.webp', price: null, specifications: {} })
      .expect(400);
  });

  it('удаляет товар', async () => {
    const list = await request(app.getHttpServer()).get(`/products?categoryId=${midId}`).expect(200);
    const id = listSchema.parse(list.body).items[0].id;

    await request(app.getHttpServer()).delete(`/products/${id}`).expect(200);
    await request(app.getHttpServer()).get(`/products/${id}`).expect(404);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падают**

Run: `nvm use && pnpm --filter @pnewmo/api db:test:setup && pnpm --filter @pnewmo/api db:test:migrate && pnpm --filter @pnewmo/api test:e2e -- products`
Expected: FAIL — маршрутов `/products` нет, ответы 404.

- [ ] **Step 3: Реализовать контроллер**

Create `apps/api/src/products/products.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { contract, type Product } from '@pnewmo/api-contract';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { ProductRow } from './products.repository';
import { ProductsService } from './products.service';

/**
 * Явный маппинг, хотя ProductRow сейчас совпадает с DTO по форме. Смысл в
 * границе: если select в репозитории расширят, лишние поля не уедут клиенту
 * автоматически. То же решение, что в CategoriesController.
 */
function toDto(row: ProductRow): Product {
  return {
    id: row.id,
    externalId: row.externalId,
    categoryId: row.categoryId,
    name: row.name,
    imageUrl: row.imageUrl,
    price: row.price,
    quantity: row.quantity,
    unit: row.unit,
    description: row.description,
    aiDescription: row.aiDescription,
    specifications: row.specifications,
    specificationsFull: row.specificationsFull,
  };
}

@Controller()
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @TsRestHandler(contract.products.list)
  list() {
    return tsRestHandler(contract.products.list, async ({ query }) => {
      const result = await this.service.getList({
        categoryId: query.categoryId,
        offset: query.offset,
        limit: query.limit,
      });

      return {
        status: 200 as const,
        body: { items: result.items.map(toDto), total: result.total },
      };
    });
  }

  @TsRestHandler(contract.products.getById)
  getById() {
    return tsRestHandler(contract.products.getById, async ({ params }) => ({
      status: 200 as const,
      body: toDto(await this.service.getById(params.id)),
    }));
  }

  @TsRestHandler(contract.products.create)
  create() {
    return tsRestHandler(contract.products.create, async ({ body }) => ({
      status: 201 as const,
      body: toDto(await this.service.create(body)),
    }));
  }

  @TsRestHandler(contract.products.update)
  update() {
    return tsRestHandler(contract.products.update, async ({ params, body }) => ({
      status: 200 as const,
      body: toDto(await this.service.update(params.id, body)),
    }));
  }

  @TsRestHandler(contract.products.remove)
  remove() {
    return tsRestHandler(contract.products.remove, async ({ params }) => ({
      status: 200 as const,
      body: await this.service.remove(params.id),
    }));
  }
}
```

Create `apps/api/src/products/products.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { ProductsController } from './products.controller';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
```

`apps/api/src/app.module.ts` — добавить `ProductsModule` в `imports` после `CategoriesModule`.

- [ ] **Step 4: Запустить e2e**

Run: `nvm use && pnpm --filter @pnewmo/api test:e2e`
Expected: PASS — и товары, и категории (последние проверяют, что `path` в ответе не сломал их схему).

- [ ] **Step 5: Проверить всё разом**

Run: `nvm use && pnpm typecheck && pnpm build && pnpm --filter @pnewmo/api lint && pnpm test`
Expected: всё зелёное, линтеры пакетов бэкенда молчат.

- [ ] **Step 6: Проверить руками на живых данных**

Run:
```bash
nvm use && pnpm dev &
curl -s "http://localhost:4000/products?limit=2" | head -c 400
curl -s "http://localhost:4000/categories" | python3 -c "import sys,json;d=json.load(sys.stdin);print('категорий',len(d));print(d[0])"
ROOT=$(curl -s "http://localhost:4000/categories" | python3 -c "import sys,json;print([c['id'] for c in json.load(sys.stdin) if c['parentId'] is None][0])")
curl -s "http://localhost:4000/products?categoryId=$ROOT&limit=1" | python3 -c "import sys,json;print('total в корне:',json.load(sys.stdin)['total'])"
```
Expected: категорий 222; `total` в корне заметно больше нуля — это главная проверка того, что выборка идёт по поддереву, а не по собственным товарам.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(api): expose products CRUD over http"
```

---

## Отложено в этом плане

1. **Пересчёт путей при перемещении категории.** `CategoriesService.update` позволяет сменить `parentId`, но путь поддерева при этом не пересчитывается. До появления интерфейса перемещения в админке это недостижимо; когда появится — обязательная отдельная задача, иначе выборка поддерева начнёт врать молча.
2. **`externalId` для товаров из админки** генерируется как `manual-<время>-<случайное>`. Некрасиво, но колонка `NOT NULL UNIQUE`, а естественного ключа у товара, созданного руками, нет.
3. **Аутентификация.** `POST /products` доступен без токена. Решение заказчика, зафиксировано в спеке.

## Self-review

- Спека, раздел «Схема» → Task 2 и Task 3. «Дубли» → Task 4, Step 1 и тест в Step 2. «Сиды» → Task 5. «Контракт» → Task 1 и Task 3. «Слои модуля» → Task 6, Task 7. «Тесты» → Task 3, 4, 5, 6, 7.
- Заглушек нет: каждый шаг содержит код или команду с ожидаемым результатом.
- Типы согласованы: `ProductRow` определён в Task 6 Step 3 и используется в Task 6 Step 4 и Task 7 Step 3 с тем же набором полей. `CategoryRow` расширяется в Task 3 Step 2 и потребляется контроллером в Task 3 Step 3.
- Требование спеки «GIN по specifications» закрыто в Task 2, Step 4, хотя используется только этапом 4c.
- Сборка остаётся зелёной после каждой задачи: контракт товаров (Task 1) никем не реализован, но типов не ломает, а связка «контракт + репозиторий + контроллер» для `path` идёт одной задачей 3.
