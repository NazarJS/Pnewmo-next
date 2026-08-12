# Код-стайл бэкенда

Как пишется код в `apps/api` и `packages/api-contract`. Каждый пример взят из
существующего файла — путь указан над блоком. Блоки, помеченные «Антипаттерн», кода в
проекте не имеют и показывают, чего делать не надо.

Документ описывает **как**. За **почему** — скилл `nestjs-expert`, `references/principles.md`.

---

## 1. Структура модуля

Эталон — `apps/api/src/categories/`:

```
apps/api/src/categories/
├── categories.controller.ts   обработчики ts-rest, маппинг в DTO
├── categories.service.ts      бизнес-правила
├── categories.repository.ts   только запросы Prisma
└── categories.module.ts       сборка
```

Порядок создания: контракт в `packages/api-contract` → репозиторий → сервис →
контроллер → модуль. Схема данных первее всего.

Общее для всех модулей — в `apps/api/src/common/`:

```
common/
├── errors/    AppError, AppException, чистые маппинги
└── filters/   AppExceptionFilter
```

Подпапки внутри модуля (`entities/`, `dto/`) не заводятся, пока в модуле по одному
файлу каждого вида. Появится второй репозиторий — появится папка.

---

## 2. Именование

**Файлы** — kebab-case с суффиксом роли: `categories.service.ts`,
`app-exception.filter.ts`, `error-mapping.ts`, `app-error.enum.ts`.

**Классы** — PascalCase с суффиксом: `CategoriesService`, `CategoriesRepository`,
`AppExceptionFilter`, `PrismaService`.

**Методы** — camelCase, глагол в начале: `getList`, `getById`, `getParentId`,
`countChildren`, `assertParentExists`, `assertNoCycle`.

Приватные проверки называются `assert*` и **бросают** исключение, а не возвращают
`boolean`. Из `apps/api/src/categories/categories.service.ts`:

```ts
private async assertParentExists(parentId: number | null | undefined): Promise<void>
private async assertNoCycle(id: number, newParentId: number | null): Promise<void>
```

**Таблицы и колонки БД** — snake_case через `@@map` и `@map`. Из
`apps/api/prisma/schema.prisma`:

```prisma
model Category {
  parentId  Int?     @map("parent_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("categories")
}
```

**Комментарии** — на русском, объясняют причину, а не действие. Комментарий, повторяющий
код словами, не нужен.

---

## 3. Prisma

### Генератор и конфигурация

Из `apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}
```

Блока `url` в `datasource` нет: адрес для CLI задаётся в `apps/api/prisma.config.ts`,
для рантайма — строкой подключения пула.

Сгенерированный клиент лежит **внутри `src`** и в git не попадает. Причина не
косметическая: у `apps/api/tsconfig.json` нет `include`, поэтому файлы вне `src`
сдвигают вычисленный `rootDir`, и сборка выдаёт `dist/src/main.js` вместо `dist/main.js`.

### Подключение

Из `apps/api/src/prisma/prisma.service.ts`:

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
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

Три обязательных момента:

- адрес читается через `ConfigService`, а не из `process.env` напрямую — как зависимость
  конструктора он гарантированно готов, а чтение в поле класса произошло бы до загрузки
  `.env` модулем конфигурации;
- `getOrThrow`, а не `get` — падаем сразу с внятным сообщением вместо `undefined` в
  строке подключения;
- пул закрывается в `onModuleDestroy`. Он наш, и незакрытый пул оставляет процесс Jest
  висеть после прогона.

`PrismaModule` помечен `@Global()`: соединение с базой — инфраструктура на всё
приложение, как `TypeOrmModule.forRoot()`. Репозитории домена глобальными **не** делаются.

### Миграции

Изменили схему — `pnpm db:migrate --name понятное_имя`. Миграции в git, править
применённые нельзя. На прод только `migrate deploy`.

**Антипаттерн:** `prisma db push` на проде. Он приводит схему к желаемому виду без
истории миграций, то есть без возможности повторить или откатить изменение.

---

## 4. Репозиторий

Из `apps/api/src/categories/categories.repository.ts`:

```ts
export interface CategoryRow {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
}

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

  getParentId(id: number): Promise<{ parentId: number | null } | null> {
    return this.prisma.category.findUnique({ where: { id }, select: { parentId: true } });
  }
}
```

Правила:

- **`select` всегда явный.** То, что не выбрано, невозможно случайно отдать клиенту:
  `createdAt` и `updatedAt` просто не существуют в объекте.
- **Возвращается свой тип** (`CategoryRow`), а не сущность Prisma.
- **Методы узкие, под конкретную задачу.** `getParentId` выбирает одно поле, потому что
  обходу дерева больше ничего не нужно. Узкий метод ещё и подставляется в тестах проще.
- **`PrismaService` инжектится только здесь.** В сервисе его нет.
- Никаких бизнес-правил и проверок прав.

**Антипаттерн — универсальная обёртка:**

```ts
// ❌ Обёртка «чтобы можно было заменить ORM»
class BaseRepository<T> {
  findAll(): Promise<T[]> { /* ... */ }
  findOne(id: number): Promise<T | null> { /* ... */ }
}
```

Теряется типизированный запрос Prisma, появляется протекающая абстракция, а ORM всё
равно никогда не меняется.

**Антипаттерн — возврат построителя запроса наружу:**

```ts
// ❌ Репозиторий отдаёт незавершённый запрос
getQuery() {
  return this.prisma.category;
}
```

Тогда запросы формируются в сервисе, и граница слоёв исчезает.

---

## 5. Сервис

Из `apps/api/src/categories/categories.service.ts`:

```ts
@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  async getById(id: number): Promise<CategoryRow> {
    const category = await this.repository.getById(id);

    if (!category) {
      throw new AppException(AppError.NOT_FOUND, `Категория ${id} не найдена`);
    }

    return category;
  }

  async remove(id: number): Promise<{ id: number }> {
    await this.getById(id);

    const children = await this.repository.countChildren(id);

    if (children > 0) {
      throw new AppException(
        AppError.CONFLICT,
        `Нельзя удалить категорию: у неё ${children} подкатегорий`,
      );
    }

    const removed = await this.repository.remove(id);

    return { id: removed.id };
  }
}
```

Правила:

- **Бросает `AppException` с кодом `AppError`**, никогда `HttpException`. Статусы
  назначает фильтр, сервис про HTTP не знает.
- **Сообщения на русском и конкретные.** `у неё 2 подкатегорий` полезнее, чем
  `конфликт`: их прочитает человек в форме админки.
- **Правило домена живёт здесь, даже если база тоже его защищает.** Проверка потомков
  перед удалением дублирует `onDelete: Restrict` — намеренно: ограничение в базе даёт
  общее сообщение про внешний ключ, а внятный текст возможен только там, где известен
  домен. База при этом остаётся страховкой от гонки.
- Зависимости — `private readonly`.
- `Logger` заводится, когда есть что логировать; пустой логгер не нужен.

### Отличие NOT_FOUND от VALIDATION_FAILED

Не найден запрашиваемый ресурс — `NOT_FOUND` (404). Не найдено то, на что **ссылаются
входные данные** — `VALIDATION_FAILED` (400): сам запрос некорректен.

Из того же файла:

```ts
throw new AppException(
  AppError.VALIDATION_FAILED,
  `Родительская категория ${parentId} не найдена`,
);
```

### Когда сервис делится на несколько

Больше 300 строк, больше пяти зависимостей в конструкторе, либо выделяется
самостоятельная вспомогательная логика. До этого — один файл.

---

## 6. Контроллер

Из `apps/api/src/categories/categories.controller.ts`:

```ts
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

  @TsRestHandler(contract.categories.getById)
  getById() {
    return tsRestHandler(contract.categories.getById, async ({ params }) => ({
      status: 200 as const,
      body: toDto(await this.service.getById(params.id)),
    }));
  }
}
```

Правила:

- **Путь и метод не пишутся в контроллере.** Они в контракте, `@TsRestHandler` их берёт
  оттуда. В логе запуска видно `Mapped {/categories/:id, GET}`, хотя строки `/categories`
  в контроллере нет.
- **Маппинг в DTO явный**, даже когда формы совпадают: если `select` в репозитории
  когда-нибудь расширят, лишние поля не уедут клиенту автоматически.
- **Никакой бизнес-логики.** Проверки, запросы к базе, ветвления по правилам — в сервисе.
- `status: 200 as const` обязателен: без `as const` тип расширяется до `number` и
  перестаёт сходиться с контрактом.

### Синхронный обработчик

`tsRestHandler` требует промис. Если работы асинхронной нет, промис создаётся явно, а не
через `async` без `await` — иначе eslint справедливо ругается на `require-await`. Из
`apps/api/src/health/health.controller.ts`:

```ts
return tsRestHandler(contract.health.check, () =>
  Promise.resolve({
    status: 200 as const,
    body: { status: 'ok' as const, uptime: process.uptime() },
  }),
);
```

**Антипаттерн:**

```ts
// ❌ Бизнес-логика и прямой доступ к данным в контроллере
@TsRestHandler(contract.categories.create)
create() {
  return tsRestHandler(contract.categories.create, async ({ body }) => {
    const existing = await this.repository.getBySlug(body.slug);
    if (existing) throw new AppException(AppError.CONFLICT, 'Занято');
    return { status: 201, body: await this.repository.create(body) };
  });
}
```

Здесь три нарушения сразу: правило в контроллере, репозиторий в обход сервиса и сущность
без маппинга.

---

## 7. Контракт

Из `packages/api-contract/src/category.contract.ts`:

```ts
export const categorySchema = z.object({
  id: z.number().int(),
  parentId: z.number().int().nullable(),
  slug: z.string(),
  name: z.string(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(
      /^[a-z0-9_-]+$/,
      'Допустимы только строчные латинские буквы, цифры, дефис и подчёркивание',
    ),
  parentId: z.number().int().positive().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

const idParam = z.object({ id: z.coerce.number().int().positive() });
```

Правила:

- **`z.coerce.number()` для параметров пути.** Параметр приходит строкой, и обычный
  `z.number()` отверг бы любой корректный запрос.
- **Своё сообщение у каждой нетривиальной проверки.** Дефолтное `Invalid` от Zod уедет
  в форму и ничего пользователю не объяснит.
- **Схема обновления — `.partial()` от схемы создания**, а не отдельный литерал: иначе
  они разойдутся при первой же правке.
- **DTO содержит только то, что нужно клиенту.** `createdAt` и `updatedAt` не включены:
  в ответе они создавали бы обязательство, которого никто не просил.
- Одна схема ошибки на все роуты — `appErrorSchema` из `packages/api-contract/src/app-error.ts`.

---

## 8. Обработка ошибок

Три файла в `apps/api/src/common/`:

**`errors/app-error.enum.ts`** — коды домена: `NOT_FOUND`, `VALIDATION_FAILED`,
`CONFLICT`, `INTERNAL`. Код без применения не заводится.

**`errors/app.exception.ts`** — `AppException extends Error` с полем `code`. Именно
`Error`, а не `HttpException`: домен не знает про HTTP.

**`errors/error-mapping.ts`** — чистые функции: `statusByAppError`,
`appErrorByPrismaCode`, `appErrorByStatus`, `extractTsRestIssues`. Вынесены отдельно от
фильтра, чтобы покрываться юнит-тестами без `ArgumentsHost`.

**`filters/app-exception.filter.ts`** — единственное место, где ошибка превращается в
HTTP-ответ. Порядок распознавания: `AppException` → известная ошибка Prisma → ошибка
валидации ts-rest → прочий `HttpException` → всё остальное.

Форма тела всегда одна, `appErrorSchema`. Клиенту не приходится разбирать два формата.

Наружу уходит **своё** сообщение, никогда текст от Prisma: в нём встречаются имена
таблиц и фрагменты схемы. Из `apps/api/src/common/filters/app-exception.filter.ts`:

```ts
function prismaMessage(code: string): string {
  switch (code) {
    case 'P2002':
      return 'Запись с таким значением уже существует';
    case 'P2003':
      return 'Нельзя выполнить операцию: на запись ссылаются другие данные';
    default:
      return 'Внутренняя ошибка сервера';
  }
}
```

### Ошибки валидации ts-rest

`@ts-rest/nest` бросает `RequestValidationError extends BadRequestException` с телом
`{ paramsResult, headersResult, queryResult, bodyResult }`. Класс **не экспортирован в
типах пакета**, поэтому `instanceof` недоступен, и распознавание идёт по форме тела —
так не зависим ни от неэкспортированного типа, ни от смены его имени.

Опции для замены обработчика у Nest-адаптера нет: `TsRestOptions` содержит только
`jsonQuery`, `validateResponses`, `validateRequestHeaders`, `validateRequestQuery`,
`validateRequestBody`. Аналог `requestValidationErrorHandler` есть у Express, Fastify и
serverless, но не у Nest.

### `validateResponses`

Включено в `apps/api/src/app.module.ts`. Ответ, не соответствующий контракту, даёт 500 —
это ожидаемое поведение: нарушение контракта на сервере есть баг сервера, и 500 честнее
200 с неправильным телом.

---

## 9. Тесты

### Юнит-тесты — на бизнес-логику, без базы

Из `apps/api/src/categories/categories.service.spec.ts`:

```ts
type RepositoryStub = Pick<
  CategoriesRepository,
  'getList' | 'getById' | 'getParentId' | 'countChildren' | 'create' | 'update' | 'remove'
>;

function makeRepository(): CategoriesRepository {
  const byId = new Map(rows.map((row) => [row.id, row]));

  const stub: RepositoryStub = {
    getById: (id) => Promise.resolve(byId.get(id) ?? null),
    getParentId: (id) => {
      const row = byId.get(id);

      return Promise.resolve(row ? { parentId: row.parentId } : null);
    },
    // ...
  };

  return stub as unknown as CategoriesRepository;
}
```

`Pick` даёт литералу контекстную типизацию — без него параметры стали бы неявными `any`
и strict-режим отверг бы файл. Двойное приведение в конце необходимо: у класса есть
приватное поле `prisma`, поэтому структурного совпадения недостаточно.

Возможность подставить заглушку — практическая причина существования слоя репозитория.

### E2E — на HTTP-контур, против отдельной базы

Из `apps/api/test/categories.e2e-spec.ts`:

```ts
const response = await request(app.getHttpServer()).get('/categories').expect(200);
const body = categoryListSchema.parse(response.body);

expect(body).toHaveLength(3);
```

**Тело разбирается схемой контракта**, а не проверяется по отдельным полям: схема
утверждает форму целиком, включая то, чего тест не читает.

Тесты работают против базы `pnewmo_test`, подмена адреса — в `apps/api/test/setup-env.ts`.
Отдельная база обязательна: `beforeEach` вызывает `TRUNCATE`, и по dev-базе это снесло бы
сиды.

Из `apps/api/test/prisma.e2e-spec.ts`:

```ts
it('points at the test database, not the dev one', async () => {
  const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;

  expect(rows[0]?.db).toBe('pnewmo_test');
});
```

Этот тест важнее, чем кажется: он не даёт прогону незаметно уехать в рабочие данные.

---

## 10. Грабли окружения

Каждый пункт стоил времени. Ответ здесь — за секунды.

**Prisma 7 не похожа на 6.** Генератор `prisma-client` вместо `prisma-client-js`,
`output` обязателен, нужен `moduleFormat = "cjs"` под нашу компиляцию в CommonJS.
Генерируется **TypeScript**, а не готовый JS. Рантайм требует драйвер-адаптера,
`datasourceUrl` и `new PrismaClient()` без аргументов не работают. Примеры для шестой
версии, которых в интернете большинство, не заведутся.

**Jest и Prisma 7 — два обязательных обхода.** Генерируемый клиент импортирует
относительные пути с суффиксом `.js`; `tsc` под `nodenext` резолвит их в `.ts`, а
резолвер Jest — нет, поэтому в обоих конфигах Jest стоит
`moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }`. Рантайм Prisma использует
динамический `import()`, который VM Jest отвергает, поэтому скрипты тестов запускаются с
`NODE_OPTIONS=--experimental-vm-modules`.

**`tsBuildInfoFile` обязан лежать внутри `dist`.** `nest-cli.json` содержит
`deleteOutDir`, который удаляет сборку, но не состояние инкрементальной компиляции рядом
с ней. Расхождение приводит к тому, что `nest build` **завершается успешно и не выдаёт
ни одного файла** — поломка бесшумная. Проверять надо существование `dist/main.js`, а не
код возврата.

**Паттерн `.gitignore` со слешем в середине привязан к каталогу файла.** Запись
`src/generated/` покрывает только корень репозитория, а не `apps/api/src/generated/`.
Нужен `**/src/generated/`. Проверять через `git check-ignore -v <путь>`.

**pnpm пробрасывает разделитель `--` дальше в команду.** Поэтому аргументы передаются
без него: `pnpm db:psql -tAc 'select 1'`, а не `pnpm db:psql -- -tAc '...'`.

**Правя контракт, запускать `pnpm dev`.** `packages/api-contract` компилируемый, и его
`tsc --watch` поднимает только turbo. При `pnpm --filter @pnewmo/api dev` изменения
контракта не подхватятся, и отлаживаться будет старая сборка — молча.

**Сгенерированный клиент Prisma не в git.** На новой машине нужен `pnpm db:generate`;
`pnpm bootstrap` его уже вызывает.

**corepack на этой конфигурации сломан.** pnpm ставится через `npm i -g pnpm@10`.
Обход для corepack, если понадобится: `COREPACK_INTEGRITY_KEYS=0`.

**`updated_at` не имеет значения по умолчанию в базе.** `@updatedAt` у Prisma —
клиентский механизм, поэтому сырой `INSERT` обязан указывать колонку явно.
