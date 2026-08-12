# Паттерны, антипаттерны и чеклист ревью

---

## Порядок создания модуля

1. **Контракт** в `packages/api-contract/src/<feature>.contract.ts` — форма определяет всё
   остальное. Подключить в `src/index.ts`.
2. **Схема** в `apps/api/prisma/schema.prisma`, затем `pnpm db:migrate --name <имя>`.
3. **Репозиторий** — запросы под конкретные задачи.
4. **Сервис** — правила, `AppException` для нарушений.
5. **Контроллер** — обработчики `tsRestHandler`, маппинг в DTO.
6. **Модуль** — контроллер в `controllers`, сервис и репозиторий в `providers`.
   `PrismaModule` в `imports` не нужен, он глобальный.
7. Подключить модуль в `app.module.ts`.

Тесты пишутся вместе с кодом: юнит на правила сервиса, e2e на роуты.

## Шаблон метода репозитория

```ts
const columns = { id: true, parentId: true, slug: true, name: true } as const;

getList(): Promise<CategoryRow[]> {
  return this.prisma.category.findMany({
    select: columns,
    orderBy: [{ parentId: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
  });
}
```

`select` вынесен в константу: один список на весь репозиторий, невозможно забыть поле в
одном методе из пяти.

Метод под задачу, а не универсальный:

```ts
// Обходу дерева нужен только parentId — не выбираем строку целиком
getParentId(id: number): Promise<{ parentId: number | null } | null> {
  return this.prisma.category.findUnique({ where: { id }, select: { parentId: true } });
}
```

## Шаблон метода сервиса

```ts
async getById(id: number): Promise<CategoryRow> {
  const category = await this.repository.getById(id);

  if (!category) {
    throw new AppException(AppError.NOT_FOUND, `Категория ${id} не найдена`);
  }

  return category;
}
```

Проверки-предикаты называются `assert*`, бросают исключение и возвращают `void`:

```ts
private async assertParentExists(parentId: number | null | undefined): Promise<void>
private async assertNoCycle(id: number, newParentId: number | null): Promise<void>
```

Возвращать `boolean` из такой проверки — приглашение забыть её результат.

## Обход дерева со страховкой

```ts
const visited = new Set<number>();
let cursor: number | null = newParentId;

while (cursor !== null) {
  if (cursor === id) {
    throw new AppException(AppError.VALIDATION_FAILED, 'Нельзя переместить категорию в её собственного потомка');
  }

  // Страховка от уже испорченных данных: если цикл каким-то образом попал в
  // базу, обход не должен зависнуть.
  if (visited.has(cursor)) {
    return;
  }

  visited.add(cursor);

  const parent = await this.repository.getParentId(cursor);

  cursor = parent?.parentId ?? null;
}
```

Любой обход по ссылкам в базе получает `visited`. Данные могли испортиться до появления
проверки.

---

## Таблица замен: рецепты TypeORM → Prisma

Большинство материалов по NestJS написаны под TypeORM. Соответствия:

| TypeORM | Prisma |
|---|---|
| `entities/{feature}.entity.ts` | папки нет, схема в `prisma/schema.prisma` |
| `@InjectRepository(Entity)` | `PrismaService` в конструкторе репозитория |
| `FindOptionsWhere<Entity>` | `Prisma.CategoryWhereInput` |
| `In(ids)` | `{ id: { in: ids } }` |
| `ILike('%q%')` | `{ contains: q, mode: 'insensitive' }` |
| `Raw((alias) => ...)` | `$queryRaw` с параметрами |
| `relations: ['children']` | `include: { children: true }` |
| `select: ['id', 'name']` | `select: { id: true, name: true }` |
| `findAndCount` | `$transaction([findMany, count])` |
| `repository.save(entity)` | `create` или `update`, разные операции |
| `synchronize: true` | антипаттерн: `prisma db push` на проде вместо `migrate deploy` |
| «Нет TypeORM в Service» | «Нет `PrismaService` в Service, только через Repository» |

Переносится без изменений: SRP и запрет логики в контроллере, маппинг в DTO, whitelist
полей сортировки (это про инъекции, не про ORM), запрет `any`, `private readonly` для
зависимостей, `Logger` в сервисах, запреты God Service, Silent Errors, мутации входных
параметров и преждевременных абстракций.

---

## Антипаттерны

### God Service

```ts
// ❌ Больше пяти зависимостей — сервис делает слишком много
constructor(
  private readonly categories: CategoriesRepository,
  private readonly products: ProductsRepository,
  private readonly orders: OrdersRepository,
  private readonly mailer: MailerService,
  private readonly csv: CsvService,
  private readonly telegram: TelegramService,
) {}
```

Разделить по ответственности.

### Протекающая абстракция

```ts
// ❌ Репозиторий отдаёт незавершённый запрос наружу
getQuery() {
  return this.prisma.category;
}
```

Тогда запросы формируются в сервисе, и граница слоёв исчезает.

### Магические строки

```ts
if (error.code === 'P2002') { /* ... */ }        // ❌ в сервисе
if (body.errorCode === 'CONFLICT') { /* ... */ } // ❌ вместо AppError.CONFLICT
```

Коды Prisma живут в `error-mapping.ts`, доменные — в перечислении `AppError`.

### Проглоченная ошибка

```ts
// ❌ Ошибка исчезла
try {
  await this.repository.remove(id);
} catch {
  return { id };
}
```

Либо обработать осмысленно, либо пробросить. Фильтр разберётся.

### Утечка внутренностей наружу

```ts
// ❌ Текст Prisma содержит имена таблиц и фрагменты схемы
return { errorCode: 'INTERNAL', message: prismaError.message };
```

Наружу — своё сообщение, подробности в лог.

### Over-fetching

```ts
// ❌ Загружается дерево, когда нужен один идентификатор
const category = await this.prisma.category.findUnique({
  where: { id },
  include: { children: { include: { children: true } } },
});
```

### Мутация входных параметров

```ts
// ❌ Изменение аргумента
async create(data: CreateCategoryInput) {
  data.slug = data.slug.toLowerCase();
  return this.repository.create(data);
}

// ✅ Новый объект
async create(data: CreateCategoryInput) {
  return this.repository.create({ ...data, slug: data.slug.toLowerCase() });
}
```

### `async` без `await`

```ts
// ❌ eslint справедливо ругается: require-await
@TsRestHandler(contract.health.check)
async check() {
  return tsRestHandler(contract.health.check, async () => ({ status: 200 as const, body }));
}

// ✅ Промис создаётся явно
@TsRestHandler(contract.health.check)
check() {
  return tsRestHandler(contract.health.check, () => Promise.resolve({ status: 200 as const, body }));
}
```

### Преждевременная абстракция

`BaseService`, `BaseRepository`, обёртки над Prisma, интерфейсы с единственной
реализацией, фабрики без выбора. Всё это добавляется, когда появляется вторая реализация,
а не в ожидании её.

---

## Чеклист код-ревью

### Слои

- [ ] `PrismaService` только в репозитории, в сервисе его нет
- [ ] Нет бизнес-правил в контроллере
- [ ] Нет запросов к базе в сервисе
- [ ] Нет проверок прав в репозитории
- [ ] Сущности Prisma не покидают контроллер: есть маппинг в DTO
- [ ] Репозиторий объявлен в своём модуле, не глобально

### Prisma

- [ ] Каждый запрос с явным `select`
- [ ] Методы репозитория узкие, под конкретную задачу
- [ ] Изменение схемы сопровождается миграцией
- [ ] Нет `$queryRawUnsafe` с подстановкой пользовательского ввода
- [ ] Транзакция там, где пишутся две и более таблицы

### Контракт

- [ ] `z.coerce.number()` для числовых параметров пути
- [ ] Своё сообщение у каждой нетривиальной проверки Zod
- [ ] Схема обновления — `.partial()` от схемы создания
- [ ] Все коды ответов, которые роут действительно отдаёт, объявлены
- [ ] В DTO нет полей, которые клиенту не нужны

### Ошибки

- [ ] Домен бросает `AppException`, не `HttpException`
- [ ] Код взят из `AppError`, а не строковый литерал
- [ ] Ссылка на несуществующую запись во входных данных — `VALIDATION_FAILED`, не `NOT_FOUND`
- [ ] Нет пустых `catch`
- [ ] Наружу не уходят тексты Prisma
- [ ] Сообщение осмысленно для человека, который его прочитает

### Типы

- [ ] Нет `any`; для неизвестной формы — `unknown` с проверками
- [ ] У публичных методов явный возвращаемый тип
- [ ] Приведение типа объяснено комментарием

### Тесты

- [ ] Бизнес-правило покрыто юнит-тестом с заглушкой репозитория
- [ ] Новый роут покрыт e2e
- [ ] Тела ответов в e2e разбираются схемой контракта
- [ ] E2E не зависят от порядка выполнения

### Простота

- [ ] Нет `Base*`-классов и обёрток над Prisma
- [ ] Нет интерфейсов с единственной реализацией
- [ ] Нет утилит для одноразовой операции
- [ ] Комментарии объясняют причину, а не пересказывают код

### Не придираться

Паттерн, применённый по всей кодовой базе, замечанием не является — если он неверен, это
отдельная задача на весь код, а не претензия к текущему диффу. Предложения вне границ
изменения — тоже не замечания.
