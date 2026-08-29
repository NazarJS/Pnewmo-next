# Этап 4b: витрина на реальном API — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести меню, каталог и карточку товара с `json-server` на реальный API, вывести карточки с пагинацией серверным рендером и добавить админ-страницу с формами создания.

**Architecture:** Server Component читает `searchParams`, префетчит список в серверный `QueryClient` и отдаёт клиенту дегидратированный кэш через `HydrationBoundary` — HTML приходит готовым, клиент не запрашивает те же данные повторно. Кешируются данные, а не роут: страница с `searchParams` в Next 16 рендерится динамически, поэтому `revalidate` на странице не работает, и его место занимает `unstable_cache` с тегами.

**Tech Stack:** Next 16.2.6 (Turbopack), React 19.2.6, TanStack Query 5.101.4, `@ts-rest/react-query` 3.52.1, react-hook-form, Jest 30 + ts-jest.

**Spec:** `.claude/docs/superpowers/specs/2026-08-28-catalog-frontend-design.md`

## Global Constraints

- **Требуется завершённый этап 4a.** API должен отдавать `/products` и `path` в категориях. Без этого план не стартует.
- **Node 24.** Сначала `nvm use`.
- **React 19 и Next 16.** Паттерны из статей про React 18 и Next 14 не годятся: `ref` передаётся пропом, `forwardRef` не нужен, `params` и `searchParams` — промисы.
- **Tailwind v4**, конфигурация в CSS через `@theme`, никакого `tailwind.config.js`.
- **`pnpm lint` падает с кодом 1** — это baseline фронтенда, а не поломка. Задача не обязана его чинить, но и ухудшать его нельзя: новых ошибок eslint появиться не должно.
- **Компонент — `export default` снизу файла; хук — именованный экспорт.** Конвенция скилла `component-structure`, действует одинаково во всех слоях.
- **`apps/api` и `packages/api-contract` не трогаем** — этап 4a их закрыл.
- Комментарии на русском, объясняют «почему».
- Раскладка сущностей повторяет `panel-administration`: `lib/types.ts`, `lib/constants.ts`, `lib/queryKey.ts`, `api/hook.ts`, `api/prefetch.ts`, `index.ts`.

---

### Task 1: Серверный клиент запросов и перевод меню на API

**Files:**
- Create: `apps/web/src/shared/lib/getQueryClient.ts`
- Create: `apps/web/src/entities/category/lib/queryKey.ts`
- Create: `apps/web/src/entities/category/api/hook.ts`
- Create: `apps/web/src/entities/category/api/prefetch.ts`
- Create: `apps/web/src/entities/category/lib/mapCategory.ts`
- Create: `apps/web/src/entities/category/lib/mapCategory.spec.ts`
- Create: `apps/web/src/entities/category/index.ts`
- Create: `apps/web/jest.config.js`
- Modify: `apps/web/package.json` (jest, ts-jest, скрипт `test`)
- Modify: `apps/web/src/widgets/header/ui/header-panel/header-catalog/HeaderCatalog.tsx` (импорт хука)
- Modify: `apps/web/src/app/layout.tsx` (префетч категорий)
- Delete: `apps/web/src/entities/category/hooks/useCategories.ts`

**Interfaces:**
- Consumes: `tsr` из `@/shared/api/tsr`, `makeQueryClient` из `@/shared/lib/queryClient`, `api` из `@/shared/api/client`
- Produces: `getQueryClient()`, `CATEGORY_LIST_QUERY_KEY`, `useCategories()`, `prefetchCategories(queryClient)`, `mapCategory(dto)`

- [ ] **Step 1: Поставить Jest и написать конфиг**

```bash
nvm use
pnpm --filter @pnewmo/web add -D jest@^30 ts-jest@^29 @types/jest@^29
```

Create `apps/web/jest.config.js`:

```js
/**
 * testEnvironment: 'node', а не jsdom. Всё, что тестируется на этом этапе, —
 * чистые функции: разбор пагинации, сборка ключей, маппинг DTO, форматирование
 * цены. DOM им не нужен, а jsdom стоит секунд запуска и лишней зависимости.
 * Когда понадобится рендер компонентов, окружение меняется здесь одной строкой.
 */
module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: { '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
```

В `apps/web/package.json` в `scripts` добавить:

```json
"test": "jest --passWithNoTests"
```

- [ ] **Step 2: Написать падающий тест маппинга категории**

Create `apps/web/src/entities/category/lib/mapCategory.spec.ts`:

```ts
import { mapCategory } from './mapCategory';

describe('mapCategory', () => {
  it('переводит parentId API в parent_id фронтенда', () => {
    const result = mapCategory({ id: 5, parentId: 2, path: '2.5', slug: 'cilindry', name: 'Цилиндры' });

    expect(result.parent_id).toBe(2);
  });

  it('сохраняет null у корневой категории', () => {
    const result = mapCategory({ id: 1, parentId: null, path: '1', slug: 'pnevmatika', name: 'Пневматика' });

    expect(result.parent_id).toBeNull();
  });

  it('собирает url из слага', () => {
    const result = mapCategory({ id: 1, parentId: null, path: '1', slug: 'pnevmatika', name: 'Пневматика' });

    expect(result.url).toBe('/catalog/pnevmatika');
  });

  it('переносит путь без изменений', () => {
    const result = mapCategory({ id: 87, parentId: 14, path: '2.14.87', slug: 'iso', name: 'ISO 15552' });

    expect(result.path).toBe('2.14.87');
  });
});
```

- [ ] **Step 3: Запустить и убедиться, что падает**

Run: `nvm use && pnpm --filter @pnewmo/web test`
Expected: FAIL — `mapCategory` не найден.

- [ ] **Step 4: Реализовать маппинг**

Create `apps/web/src/entities/category/lib/mapCategory.ts`:

```ts
import type { Category as CategoryDto } from '@pnewmo/api-contract';

import { Category } from '../model/types';

/**
 * Маппинг обязателен и неочевиден. API отдаёт parentId, а дерево в
 * `categoryTree.ts` и весь хедер читают parent_id — имена полей разошлись
 * исторически. Поля url в API нет вовсе, оно вычисляется из слага.
 *
 * Пропустить маппинг — получить дерево, которое собирается пустым: у всех узлов
 * parent_id окажется undefined, и ни один не попадёт в children родителя.
 */
export function mapCategory(dto: CategoryDto): Category {
  return {
    id: dto.id,
    parent_id: dto.parentId,
    path: dto.path,
    slug: dto.slug,
    name: dto.name,
    url: `/catalog/${dto.slug}`,
  };
}
```

- [ ] **Step 5: Запустить тест**

Run: `nvm use && pnpm --filter @pnewmo/web test`
Expected: PASS, 4 теста.

- [ ] **Step 6: Серверный клиент запросов**

Create `apps/web/src/shared/lib/getQueryClient.ts`:

```ts
import { cache } from 'react';

import { makeQueryClient } from './queryClient';

/**
 * Один QueryClient на серверный запрос. `cache` из React мемоизирует вызов в
 * границах одного рендера: все Server Components запроса получают тот же
 * экземпляр, а соседний запрос — свой.
 *
 * Без этого было бы два одинаково плохих варианта: клиент-синглтон на модуле
 * (данные одного посетителя утекают другому) или новый клиент на каждый вызов
 * (префетч в странице и дегидратация в обёртке смотрят в разные кэши, и до
 * клиента не доезжает ничего).
 */
export const getQueryClient = cache(makeQueryClient);
```

- [ ] **Step 7: Ключи, хук и префетч категорий**

Create `apps/web/src/entities/category/lib/queryKey.ts`:

```ts
/**
 * Список категорий один на всё приложение: меню, страница каталога и админка
 * читают ровно его. Отдельного билдера не нужно — параметров у запроса нет.
 */
export const CATEGORY_LIST_QUERY_KEY = ['category-list'] as const;
```

Create `apps/web/src/entities/category/api/hook.ts`:

```ts
'use client';

import { tsr } from '@/shared/api/tsr';

import { mapCategory } from '../lib/mapCategory';
import { Category } from '../model/types';
import { CATEGORY_LIST_QUERY_KEY } from '../lib/queryKey';

interface UseCategoriesResult {
  categories: Category[];
  loading: boolean;
  error: string | null;
}

/**
 * Форма возврата намеренно совпадает с прежним хуком на useEffect:
 * `{ categories, loading, error }`. Благодаря этому HeaderCatalog и остальные
 * потребители не меняются вовсе — меняется только источник данных.
 */
export const useCategories = (): UseCategoriesResult => {
  const { data, isPending, error } = tsr.categories.list.useQuery({
    queryKey: CATEGORY_LIST_QUERY_KEY,
    queryData: {},
    // Категории меняются редко: дерево правят через админку штучно.
    staleTime: 10 * 60 * 1000,
    // gcTime не меньше staleTime — иначе неактивный запрос вычистится из кэша
    // раньше, чем данные устареют (глобальный дефолт gcTime — 5 минут).
    gcTime: 10 * 60 * 1000,
  });

  return {
    categories: data?.status === 200 ? data.body.map(mapCategory) : [],
    loading: isPending,
    error: error ? 'Ошибка загрузки категорий' : null,
  };
};
```

Create `apps/web/src/entities/category/api/prefetch.ts`:

```ts
import type { QueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/client';

import { CATEGORY_LIST_QUERY_KEY } from '../lib/queryKey';

/**
 * Серверный префетч. НЕ реэкспортируется из барреля: попав в клиентский бандл
 * через баррель, серверный код тянет за собой зависимости, которые в браузере
 * не работают, и ломается не на сборке, а в рантайме.
 *
 * Ключ и форма ответа обязаны совпадать с useCategories до последнего поля:
 * под этим ключом клиент будет искать готовые данные, а несовпадение обернётся
 * молчаливым повторным запросом при гидрации.
 */
export async function prefetchCategories(queryClient: QueryClient): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: CATEGORY_LIST_QUERY_KEY,
    queryFn: () => api.categories.list(),
  });
}
```

Create `apps/web/src/entities/category/index.ts`:

```ts
export * from './lib/queryKey';
export * from './lib/mapCategory';
export * from './model/types';
export * from './api/hook';
```

- [ ] **Step 8: Переключить хедер и layout**

В `HeaderCatalog.tsx` заменить импорт:

```ts
import { useCategories } from '@/entities/category/api/hook';
```

Удалить старый хук:

```bash
git rm apps/web/src/entities/category/hooks/useCategories.ts
```

В `apps/web/src/app/layout.tsx` обернуть содержимое префетчем. `RootLayout` становится асинхронным:

```tsx
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const queryClient = getQueryClient();

  // Категории нужны меню, а меню есть на каждой странице — префетчим здесь,
  // чтобы хедер не мигал состоянием загрузки при первом заходе.
  await prefetchCategories(queryClient);

  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ReactQueryProvider>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <Header />

            <main className="main">
              <div className="container">{children}</div>
            </main>

            <Footer />
          </HydrationBoundary>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
```

Импорты: `HydrationBoundary`, `dehydrate` из `@tanstack/react-query`; `getQueryClient` из `@/shared/lib/getQueryClient`; `prefetchCategories` из `@/entities/category/api/prefetch`.

- [ ] **Step 9: Проверить**

Run:
```bash
nvm use && pnpm --filter @pnewmo/web typecheck && pnpm --filter @pnewmo/web test && pnpm --filter @pnewmo/web lint:js
```
Expected: typecheck и тесты зелёные; вывод eslint не хуже прежнего — baseline из двух ошибок `react-hooks/set-state-in-effect` остаётся на месте (они живут в `HeaderCatalog.tsx`, к удаляемому хуку не относятся).

Run: `pnpm dev` и открыть `http://localhost:3000` — меню открывается и содержит категории из базы (среди них «Цилиндры пневматические», которых в моке не было).

- [ ] **Step 10: Commit**

```bash
git add apps/web
git commit -m "feat(web): read categories from the real api, add server query client"
```

---

### Task 2: Сущность товара и разбор пагинации

**Files:**
- Create: `apps/web/src/entities/product/lib/productTypes.ts`
- Create: `apps/web/src/entities/product/lib/constants.ts`
- Create: `apps/web/src/entities/product/lib/queryKey.ts`
- Create: `apps/web/src/entities/product/lib/queryKey.spec.ts`
- Create: `apps/web/src/entities/product/lib/formatPrice.ts`
- Create: `apps/web/src/entities/product/lib/formatPrice.spec.ts`
- Create: `apps/web/src/entities/product/api/productHook.ts`
- Create: `apps/web/src/entities/product/api/productPrefetch.ts`
- Create: `apps/web/src/shared/lib/pagination.ts`
- Create: `apps/web/src/shared/lib/pagination.spec.ts`

**Interfaces:**
- Consumes: `tsr`, `api`, контракт `contract.products`
- Produces: `ProductListFilterState`, `PRODUCTS_PER_PAGE`, `buildProductListQueryKey(filter)`, `buildProductListQuery(filter)`, `useProductList(filter)`, `prefetchProductList(queryClient, filter)`, `resolvePage(raw, def)`, `resolveLimit(raw, def)`, `toOffset(page, limit)`, `formatPrice(value)`

Имена файлов `productTypes.ts` и `productHook.ts` — не `types.ts` и `hook.ts` — потому что в `entities/product/` уже есть `model/types.ts` и `api/products.api.ts` от панели фильтров; одинаковые имена в соседних папках путают при чтении диффа.

- [ ] **Step 1: Написать падающие тесты пагинации**

Create `apps/web/src/shared/lib/pagination.spec.ts`:

```ts
import { resolveLimit, resolvePage, toOffset } from './pagination';

describe('resolvePage', () => {
  it('берёт число из адреса', () => {
    expect(resolvePage(3, 1)).toBe(3);
  });

  it('подставляет дефолт при отсутствии параметра', () => {
    expect(resolvePage(undefined, 1)).toBe(1);
  });

  it('отбрасывает ноль', () => {
    expect(resolvePage(0, 1)).toBe(1);
  });

  it('отбрасывает отрицательное', () => {
    expect(resolvePage(-5, 1)).toBe(1);
  });

  /**
   * Ловушка, ради которой правило и существует: Number('Infinity') даёт
   * Infinity, и наивная проверка raw > 0 его пропускает. Дальше Infinity уходит
   * в offset и роняет запрос.
   */
  it('отбрасывает Infinity', () => {
    expect(resolvePage(Number('Infinity'), 1)).toBe(1);
  });

  it('отбрасывает NaN', () => {
    expect(resolvePage(Number('abc'), 1)).toBe(1);
  });
});

describe('resolveLimit', () => {
  it('берёт число из адреса', () => {
    expect(resolveLimit(48, 24)).toBe(48);
  });

  it('подставляет дефолт на мусоре', () => {
    expect(resolveLimit(Number('Infinity'), 24)).toBe(24);
  });

  /**
   * Потолок совпадает с потолком контракта. Без него страница попросила бы
   * limit=100000, сервер ответил бы 400, и посетитель увидел бы ошибку вместо
   * товаров.
   */
  it('обрезает по потолку контракта', () => {
    expect(resolveLimit(100000, 24)).toBe(100);
  });
});

describe('toOffset', () => {
  it('первая страница начинается с нуля', () => {
    expect(toOffset(1, 24)).toBe(0);
  });

  it('вторая страница сдвинута на размер страницы', () => {
    expect(toOffset(2, 24)).toBe(24);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падают**

Run: `nvm use && pnpm --filter @pnewmo/web test -- pagination`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать разбор пагинации**

Create `apps/web/src/shared/lib/pagination.ts`:

```ts
/** Потолок из productListQuerySchema контракта. Расхождение даст 400 от сервера. */
export const MAX_LIMIT = 100;

/**
 * Чтение пагинации из URL — чистой функцией, а не выражением в теле компонента,
 * и одной и той же на сервере и на клиенте. Расхождение здесь означает, что
 * сервер отрендерил одну страницу, а клиент после гидрации показал другую.
 *
 * Number.isFinite здесь не украшение: Number('Infinity') даёт Infinity, и
 * проверка `raw > 0` его пропускает. Правило выровнено с
 * panel-administration, shared/hooks/table/utils/pagination.ts.
 */
export function resolvePage(raw: number | undefined, defaultPage: number): number {
  return raw !== undefined && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : defaultPage;
}

export function resolveLimit(raw: number | undefined, defaultLimit: number): number {
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.floor(raw), MAX_LIMIT);
}

export function toOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/** Разбор сырого значения из searchParams: массив значит повтор параметра в адресе. */
export function readNumberParam(raw: string | string[] | undefined): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === undefined ? undefined : Number(value);
}
```

- [ ] **Step 4: Запустить тесты**

Run: `nvm use && pnpm --filter @pnewmo/web test -- pagination`
Expected: PASS, 11 тестов.

- [ ] **Step 5: Написать падающие тесты ключей и цены**

Create `apps/web/src/entities/product/lib/queryKey.spec.ts`:

```ts
import { buildProductListQuery, buildProductListQueryKey } from './queryKey';
import { ProductListFilterState } from './productTypes';

describe('buildProductListQueryKey', () => {
  it('собирает позиционный массив', () => {
    const filter: ProductListFilterState = { categoryId: 7, offset: 24, limit: 24 };

    expect(buildProductListQueryKey(filter)).toEqual(['product-list', 7, 24, 24]);
  });

  it('отсутствие категории превращает в null, а не пропускает поле', () => {
    const filter: ProductListFilterState = { categoryId: undefined, offset: 0, limit: 24 };

    expect(buildProductListQueryKey(filter)).toEqual(['product-list', null, 0, 24]);
  });

  /**
   * Главная проверка. Ключ обязан не зависеть от порядка полей в объекте:
   * сервер в префетче и клиент в хуке собирают фильтр независимо, и при
   * JSON.stringify два одинаковых по смыслу фильтра дали бы разные строки —
   * страница молча ушла бы за данными второй раз при гидрации.
   */
  it('не зависит от порядка полей в объекте-источнике', () => {
    const a = { categoryId: 7, offset: 24, limit: 24 } as ProductListFilterState;
    const b = { limit: 24, offset: 24, categoryId: 7 } as ProductListFilterState;

    expect(buildProductListQueryKey(a)).toEqual(buildProductListQueryKey(b));
  });
});

describe('buildProductListQuery', () => {
  it('поля query соответствуют полям ключа', () => {
    const filter: ProductListFilterState = { categoryId: 7, offset: 24, limit: 24 };
    const key = buildProductListQueryKey(filter);
    const query = buildProductListQuery(filter);

    expect([key[1], key[2], key[3]]).toEqual([query.categoryId ?? null, query.offset, query.limit]);
  });

  it('undefined категории не уходит в query', () => {
    const query = buildProductListQuery({ categoryId: undefined, offset: 0, limit: 24 });

    expect(query.categoryId).toBeUndefined();
  });
});
```

Create `apps/web/src/entities/product/lib/formatPrice.spec.ts`:

```ts
import { formatPrice } from './formatPrice';

describe('formatPrice', () => {
  it('форматирует цену рублями без потери копеек', () => {
    // Пробел здесь неразрывный — его ставит Intl. Сравниваем по цифрам, чтобы
    // тест не сломался от смены типа пробела между версиями ICU.
    expect(formatPrice('21493.96').replace(/\s/g, ' ')).toContain('21 493,96');
  });

  it('пустую цену показывает как «Цена по запросу», а не как ноль', () => {
    expect(formatPrice(null)).toBe('Цена по запросу');
  });

  it('переживает неразбираемое значение', () => {
    expect(formatPrice('не число')).toBe('Цена по запросу');
  });
});
```

- [ ] **Step 6: Запустить и убедиться, что падают**

Run: `nvm use && pnpm --filter @pnewmo/web test -- product`
Expected: FAIL — модули не найдены.

- [ ] **Step 7: Реализовать типы, константы, ключи, цену**

Create `apps/web/src/entities/product/lib/productTypes.ts`:

```ts
import type { Product } from '@pnewmo/api-contract';

export type { Product };

/** Состояние списка товаров: всё, что влияет на выдачу, и ничего сверх того. */
export interface ProductListFilterState {
  categoryId: number | undefined;
  offset: number;
  limit: number;
}
```

Create `apps/web/src/entities/product/lib/constants.ts`:

```ts
/**
 * Размер страницы кратен трём и четырём: сетка карточек раскладывается без
 * огрызка в последнем ряду и на трёх, и на четырёх колонках. Совпадает с
 * дефолтом в контракте.
 */
export const PRODUCTS_PER_PAGE = 24;

export const DEFAULT_PAGE = 1;
```

Create `apps/web/src/entities/product/lib/queryKey.ts`:

```ts
import { ProductListFilterState } from './productTypes';

/**
 * Ключ — позиционный массив с явным перечислением полей, а не
 * JSON.stringify(filter) целиком.
 *
 * У JSON.stringify результат зависит от порядка полей объекта: два
 * семантически одинаковых фильтра, собранных в разном порядке — сервером в
 * префетче и клиентом в хуке, — дают разные строки. Страница при гидрации
 * молча уходит за данными второй раз, и заметить это в Network невозможно:
 * лишнего запроса не видно, просто данные оказываются не те.
 *
 * Правило и его обоснование взяты из panel-administration,
 * entities/pbn-pool/lib/queryKey.ts.
 */
export type ProductListQueryKey = readonly ['product-list', number | null, number, number];

export const buildProductListQueryKey = (filter: ProductListFilterState): ProductListQueryKey => [
  'product-list',
  filter.categoryId ?? null,
  filter.offset,
  filter.limit,
];

/**
 * Единственная точка сборки query из фильтра — общая для useProductList и
 * prefetchProductList. Два независимых маппинга однажды разойдутся: достаточно
 * забыть поле при добавлении фильтра, и под одинаковым ключом закэшируется
 * другая выдача.
 */
export const buildProductListQuery = (filter: ProductListFilterState) => ({
  categoryId: filter.categoryId,
  offset: filter.offset,
  limit: filter.limit,
});
```

Create `apps/web/src/entities/product/lib/formatPrice.ts`:

```ts
const formatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
});

/**
 * Цена приходит строкой от самого Postgres: Decimal через number теряет
 * точность, 21493.96 превращается в 21493.959999999999. Number вызывается
 * здесь, в последней точке перед показом, где потеря уже безразлична.
 *
 * null — это «цена неизвестна», а не «бесплатно». Показывать ноль было бы
 * враньём, поэтому у 4 товаров каталога будет «Цена по запросу».
 */
export function formatPrice(value: string | null): string {
  if (value === null) {
    return 'Цена по запросу';
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? formatter.format(parsed) : 'Цена по запросу';
}
```

- [ ] **Step 8: Запустить тесты**

Run: `nvm use && pnpm --filter @pnewmo/web test`
Expected: PASS — все тесты, включая маппинг категорий из Task 1.

- [ ] **Step 9: Хук и префетч товаров**

Create `apps/web/src/entities/product/api/productHook.ts`:

```ts
'use client';

import { keepPreviousData } from '@tanstack/react-query';

import { tsr } from '@/shared/api/tsr';

import { ProductListFilterState } from '../lib/productTypes';
import { buildProductListQuery, buildProductListQueryKey } from '../lib/queryKey';

/**
 * keepPreviousData: при переходе на следующую страницу список не схлопывается
 * в пустоту на время запроса, а показывает прежние карточки. Без него страница
 * прыгает вверх на каждом клике по пагинации.
 */
export const useProductList = (filter: ProductListFilterState) =>
  tsr.products.list.useQuery({
    queryKey: buildProductListQueryKey(filter),
    queryData: { query: buildProductListQuery(filter) },
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
```

Create `apps/web/src/entities/product/api/productPrefetch.ts`:

```ts
import type { QueryClient } from '@tanstack/react-query';

import { tsr } from '@/shared/api/tsr';

import { ProductListFilterState } from '../lib/productTypes';
import { buildProductListQuery, buildProductListQueryKey } from '../lib/queryKey';

/** Тег для сброса из мутаций админки. */
export const PRODUCTS_CACHE_TAG = 'products';

/** Пять минут: каталог правят штучно через админку, а та сбрасывает кеш тегом. */
const REVALIDATE_SECONDS = 300;

/**
 * Серверный префетч. НЕ реэкспортируется из барреля: серверный код, утёкший в
 * клиентский бандл, ломается не на сборке, а в рантайме.
 *
 * Кешируются данные, а не роут. Первоначально предполагалось поставить
 * `export const revalidate` на страницу каталога — это не работает: в Next 16
 * searchParams устроен как «висящий» промис, и первое же его разворачивание
 * помечает доступ динамическим, выбивая страницу из статической оболочки. А
 * пагинация без чтения searchParams невозможна.
 *
 * Поэтому кеш вешается на сам fetch через fetchOptions.next. Проверено по типам
 * @ts-rest/core 3.52.1: аргументы запроса принимают `fetchOptions?: FetchOptions`,
 * а FetchOptions выводится из параметров конструктора Request — который в Next
 * расширен полем `next`. Верхнеуровневый `next` там же помечен deprecated в
 * пользу `fetchOptions.next`.
 *
 * HTML при этом собирается на каждый запрос — боты получают полную разметку, —
 * но база опрашивается раз в пять минут на комбинацию параметров.
 */
export async function prefetchProductList(
  queryClient: QueryClient,
  filter: ProductListFilterState,
): Promise<void> {
  // initQueryClient связывает контракт с переданным QueryClient и кладёт ответ
  // в кэш ровно в той форме, которую ждёт клиентский хук: { status, body,
  // headers }. Собирать это значение руками через setQueryData — верный способ
  // ошибиться в форме и получить молчаливый повторный запрос при гидрации.
  const tsrQC = tsr.initQueryClient(queryClient);

  await tsrQC.products.list.prefetchQuery({
    // Ключ обязан совпадать с ключом useProductList до последнего элемента —
    // под ним клиент будет искать готовые данные. Поэтому оба зовут один билдер.
    queryKey: buildProductListQueryKey(filter),
    queryData: {
      query: buildProductListQuery(filter),
      fetchOptions: { next: { revalidate: REVALIDATE_SECONDS, tags: [PRODUCTS_CACHE_TAG] } },
    },
  });

  // Ошибку в кэше не оставляем: дегидратированное состояние ошибки доедет до
  // клиента и покажет сбой даже там, где повторный запрос прошёл бы успешно.
  // Приём взят из panel-administration, entities/strapi-content/api/prefetch.ts.
  const key = buildProductListQueryKey(filter);

  if (queryClient.getQueryState(key)?.status === 'error') {
    queryClient.removeQueries({ queryKey: key });
  }
}
```

Если `tsr.initQueryClient` окажется недоступен на сервере из-за того, что модуль тянет за собой компонент провайдера, завести отдельный серверный экземпляр `initTsrReactQuery` в `apps/web/src/shared/api/tsrServer.ts` с теми же `baseUrl` и контрактом — как сделано в `panel-administration`, где клиентский `tsr` помечен `'use client'`, а серверный лежит отдельно. Форма вызова при этом не меняется.

- [ ] **Step 10: Проверить сборку**

Run: `nvm use && pnpm --filter @pnewmo/web typecheck && pnpm --filter @pnewmo/web test && pnpm --filter @pnewmo/web lint:js`
Expected: всё зелёное.

- [ ] **Step 11: Commit**

```bash
git add apps/web
git commit -m "feat(web): add product entity, query keys and url pagination"
```

---

### Task 3: Страница каталога с карточками и пагинацией

**Files:**
- Rewrite: `apps/web/src/app/catalog/[slug]/page.tsx`
- Create: `apps/web/src/widgets/product-grid/ProductGrid.tsx`
- Create: `apps/web/src/widgets/product-grid/ProductGrid.module.scss`
- Create: `apps/web/src/widgets/product-grid/ui/ProductCard/ProductCard.tsx`
- Create: `apps/web/src/widgets/product-grid/ui/ProductCard/ProductCard.module.scss`
- Create: `apps/web/src/widgets/product-grid/ui/Pagination/Pagination.tsx`
- Create: `apps/web/src/widgets/product-grid/ui/Pagination/Pagination.module.scss`
- Modify: `apps/web/next.config.ts` (домен картинок)

**Interfaces:**
- Consumes: `prefetchProductList`, `useProductList`, `resolvePage`, `resolveLimit`, `toOffset`, `readNumberParam`, `formatPrice`, `PRODUCTS_PER_PAGE`
- Produces: страница `/catalog/[slug]`

- [ ] **Step 1: Разрешить домен картинок**

Картинки лежат на CDN pneumax. Без записи в `images.remotePatterns` компонент `next/image` откажется их отдавать — и это будет выглядеть как «карточки пустые».

`apps/web/next.config.ts`:

```ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: 'pneumax.ru', pathname: '/upload/**' }],
},
```

- [ ] **Step 2: Карточка товара**

Create `apps/web/src/widgets/product-grid/ui/ProductCard/ProductCard.tsx`:

```tsx
import Image from 'next/image';
import Link from 'next/link';

import { formatPrice } from '@/entities/product/lib/formatPrice';
import type { Product } from '@/entities/product/lib/productTypes';

import styles from './ProductCard.module.scss';

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <Link href={`/product/${product.id}`} className={styles.card}>
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={282}
        height={148}
        className={styles.image}
        // Размеры карточек в сетке фиксированы, поэтому sizes достаточно
        // грубого: точная подстройка не нужна, а без атрибута Next ругается.
        sizes="(max-width: 768px) 50vw, 25vw"
      />

      <h2 className={styles.name}>{product.name}</h2>

      <p className={styles.price}>{formatPrice(product.price)}</p>
    </Link>
  );
};

export default ProductCard;
```

Create `apps/web/src/widgets/product-grid/ui/ProductCard/ProductCard.module.scss`:

```scss
.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

.image {
  width: 100%;
  height: auto;
  object-fit: contain;
}

.name {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.35;
  // Длинные названия — норма: fullTitle содержит всё описание целиком.
  // Без обрезки карточки в ряду разъезжаются по высоте.
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.price {
  margin-top: auto;
  font-size: 16px;
  font-weight: 600;
}
```

- [ ] **Step 3: Пагинация**

Create `apps/web/src/widgets/product-grid/ui/Pagination/Pagination.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import styles from './Pagination.module.scss';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
}

const Pagination = ({ page, limit, total }: PaginationProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPage = Math.max(1, Math.ceil(total / limit));

  if (lastPage === 1) {
    return null;
  }

  const hrefFor = (target: number): string => {
    const params = new URLSearchParams(searchParams.toString());

    // Дефолт в адрес не пишем: первая страница остаётся чистым /catalog/slug.
    // Иначе два адреса с одинаковым содержимым — дубль для поисковика.
    if (target === 1) {
      params.delete('page');
    } else {
      params.set('page', String(target));
    }

    const query = params.toString();

    return query === '' ? pathname : `${pathname}?${query}`;
  };

  return (
    <nav className={styles.pagination} aria-label="Постраничная навигация">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={styles.link} rel="prev">
          Назад
        </Link>
      )}

      <span className={styles.status}>
        Страница {page} из {lastPage} · товаров {total}
      </span>

      {page < lastPage && (
        <Link href={hrefFor(page + 1)} className={styles.link} rel="next">
          Вперёд
        </Link>
      )}
    </nav>
  );
};

export default Pagination;
```

Create `apps/web/src/widgets/product-grid/ui/Pagination/Pagination.module.scss`:

```scss
.pagination {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
}

.link {
  padding: 8px 16px;
  border: 1px solid #c0c0c0;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
}

.status {
  font-size: 14px;
}
```

- [ ] **Step 4: Сетка**

Create `apps/web/src/widgets/product-grid/ProductGrid.tsx`:

```tsx
'use client';

import { useProductList } from '@/entities/product/api/productHook';
import type { Product } from '@/entities/product/lib/productTypes';

import styles from './ProductGrid.module.scss';
import Pagination from './ui/Pagination/Pagination';
import ProductCard from './ui/ProductCard/ProductCard';

interface ProductGridProps {
  categoryId: number;
  page: number;
  offset: number;
  limit: number;
}

/**
 * Клиентский компонент, но за данными он не ходит: их положил в кэш серверный
 * префетч под тем же ключом. useQuery здесь читает готовое — и берёт на себя
 * последующие переходы по страницам без полной перезагрузки.
 */
const ProductGrid = ({ categoryId, page, offset, limit }: ProductGridProps) => {
  const { data, isPending } = useProductList({ categoryId, offset, limit });

  if (isPending) {
    return <p>Загрузка...</p>;
  }

  if (data?.status !== 200) {
    return <p>Не удалось загрузить товары</p>;
  }

  const { items, total } = data.body;

  if (total === 0) {
    return <p>В этой категории пока нет товаров</p>;
  }

  return (
    <>
      <div className={styles.grid}>
        {items.map((product: Product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <Pagination page={page} limit={limit} total={total} />
    </>
  );
};

export default ProductGrid;
```

Create `apps/web/src/widgets/product-grid/ProductGrid.module.scss`:

```scss
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (width <= 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (width <= 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 5: Переписать страницу каталога**

Replace `apps/web/src/app/catalog/[slug]/page.tsx` целиком:

```tsx
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { prefetchProductList } from '@/entities/product/api/productPrefetch';
import { DEFAULT_PAGE, PRODUCTS_PER_PAGE } from '@/entities/product/lib/constants';
import { api } from '@/shared/api/client';
import { getQueryClient } from '@/shared/lib/getQueryClient';
import { readNumberParam, resolveLimit, resolvePage, toOffset } from '@/shared/lib/pagination';
import ProductGrid from '@/widgets/product-grid/ProductGrid';

import styles from './Catalog.module.scss';

interface CatalogPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;

  const page = resolvePage(readNumberParam(rawSearchParams.page), DEFAULT_PAGE);
  const limit = resolveLimit(readNumberParam(rawSearchParams.limit), PRODUCTS_PER_PAGE);
  const offset = toOffset(page, limit);

  const categoriesResponse = await api.categories.list();

  if (categoriesResponse.status !== 200) {
    throw new Error('Не удалось загрузить категории');
  }

  const category = categoriesResponse.body.find((item) => item.slug === slug);

  // notFound(), а не «Категория не найдена» в разметке: несуществующая
  // категория обязана отдавать 404, иначе поисковик проиндексирует её как
  // рабочую страницу.
  if (!category) {
    notFound();
  }

  const queryClient = getQueryClient();

  await prefetchProductList(queryClient, { categoryId: category.id, offset, limit });

  return (
    <div className={styles.container_page}>
      <section className={styles.section}>
        <h1 className={styles.name}>{category.name}</h1>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <ProductGrid categoryId={category.id} page={page} offset={offset} limit={limit} />
        </HydrationBoundary>
      </section>
    </div>
  );
}
```

Панель фильтров из страницы уходит — это и есть её отцепление. Файлы `features/product-filter/` и `entities/product/api/products.api.ts` остаются на месте под этап 4c.

- [ ] **Step 6: Проверить сборку и типы**

Run: `nvm use && pnpm --filter @pnewmo/web typecheck && pnpm --filter @pnewmo/web build`
Expected: зелёное. Если `products.api.ts` ссылается на удалённое — исправить импорты, но сам файл не удалять.

- [ ] **Step 7: Проверить в браузере**

Run: `pnpm dev`, открыть категорию верхнего уровня, например `http://localhost:3000/catalog/pnevmatika`.

Expected:
- карточки видны, у большинства есть цена;
- внизу «Страница 1 из N · товаров M», где M заметно больше нуля — это проверка выборки по поддереву;
- клик «Вперёд» меняет адрес на `?page=2`, кнопка «назад» браузера возвращает на первую;
- прямое открытие `?page=2` отдаёт вторую страницу.

- [ ] **Step 8: Проверить, что бот видит товары**

Run:
```bash
curl -s http://localhost:3000/catalog/pnevmatika | grep -c 'product/'
curl -s http://localhost:3000/catalog/pnevmatika | grep -o 'Цилиндр[^<]\{0,40\}' | head -3
```
Expected: ссылок на товары найдено много (не ноль), названия товаров присутствуют в HTML.

Это главный критерий задачи: разметка приходит с сервера, а не собирается JavaScript'ом.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web): render catalog products server-side with pagination"
```

---

### Task 4: Страница товара

**Files:**
- Rewrite: `apps/web/src/app/product/[id]/page.tsx`

**Interfaces:**
- Consumes: `api.products.getById`, `formatPrice`

- [ ] **Step 1: Переписать страницу**

Replace `apps/web/src/app/product/[id]/page.tsx` целиком:

```tsx
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { formatPrice } from '@/entities/product/lib/formatPrice';
import { api } from '@/shared/api/client';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    notFound();
  }

  const response = await api.products.getById({ params: { id: numericId } });

  if (response.status !== 200) {
    notFound();
  }

  const product = response.body;
  const specifications = Object.entries(product.specifications);

  return (
    <article>
      <h1>{product.name}</h1>

      <Image src={product.imageUrl} alt={product.name} width={282} height={148} sizes="282px" />

      <p>{formatPrice(product.price)}</p>

      {specifications.length > 0 && (
        <table>
          <tbody>
            {specifications.map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{key}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Проверить**

Run: `nvm use && pnpm --filter @pnewmo/web typecheck && pnpm --filter @pnewmo/web build`

Открыть карточку из каталога: название, картинка, цена и таблица характеристик на месте. Проверить `http://localhost:3000/product/99999999` — должна быть страница 404, а не ошибка.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/product
git commit -m "feat(web): read product page from the real api"
```

---

### Task 5: Админ-страница

**Files:**
- Create: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/src/features/catalog-admin/ui/CategoryForm.tsx`
- Create: `apps/web/src/features/catalog-admin/ui/ProductForm.tsx`
- Create: `apps/web/src/features/catalog-admin/ui/AdminForms.module.scss`
- Create: `apps/web/src/features/catalog-admin/api/revalidate.ts`
- Modify: `apps/web/package.json` (react-hook-form)

**Interfaces:**
- Consumes: `tsr.categories.create`, `tsr.products.create`, `useCategories`, `CATEGORY_LIST_QUERY_KEY`, `PRODUCTS_CACHE_TAG`
- Produces: страница `/admin`

- [ ] **Step 1: Поставить react-hook-form**

```bash
nvm use && pnpm --filter @pnewmo/web add react-hook-form
```

- [ ] **Step 2: Серверное действие сброса кеша**

Create `apps/web/src/features/catalog-admin/api/revalidate.ts`:

```ts
'use server';

import { revalidateTag } from 'next/cache';

import { PRODUCTS_CACHE_TAG } from '@/entities/product/api/productPrefetch';

/**
 * Сброс серверного кеша данных после мутации.
 *
 * Шаг легко забыть, и его отсутствие проявляется не сразу: товар создан, в
 * админке виден, а на витрине появится через пять минут. Поэтому он вынесен в
 * отдельную функцию — её вызов заметен в onSuccess, в отличие от строчки среди
 * прочих.
 *
 * invalidateQueries на клиенте этого не заменяет: он чистит кэш браузера, а
 * unstable_cache живёт на сервере и переживает перезагрузку страницы.
 */
export async function revalidateCatalog(): Promise<void> {
  revalidateTag(PRODUCTS_CACHE_TAG);
}
```

- [ ] **Step 3: Форма категории**

Create `apps/web/src/features/catalog-admin/ui/CategoryForm.tsx`:

```tsx
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { CATEGORY_LIST_QUERY_KEY } from '@/entities/category/lib/queryKey';
import { useCategories } from '@/entities/category/api/hook';
import { tsr } from '@/shared/api/tsr';

import { revalidateCatalog } from '../api/revalidate';
import styles from './AdminForms.module.scss';

interface CategoryFormValues {
  name: string;
  slug: string;
  parentId: string;
}

const CategoryForm = () => {
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const { register, handleSubmit, reset, formState } = useForm<CategoryFormValues>({
    defaultValues: { name: '', slug: '', parentId: '' },
  });

  const mutation = tsr.categories.create.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORY_LIST_QUERY_KEY });
      await revalidateCatalog();
      reset();
    },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate({
      body: {
        name: values.name,
        slug: values.slug,
        parentId: values.parentId === '' ? null : Number(values.parentId),
      },
    });
  });

  // Ошибку показываем ту, что пришла с сервера. Правило слага живёт в
  // контракте вместе с текстом («Допустимы только строчные латинские буквы,
  // цифры, дефис и подчёркивание») — дублировать его на клиенте значит завести
  // второй источник правды, который разойдётся с первым.
  const serverMessage =
    mutation.error && typeof mutation.error.body === 'object' && mutation.error.body !== null
      ? String((mutation.error.body as { message?: unknown }).message ?? 'Ошибка сохранения')
      : null;

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <h2>Новая категория</h2>

      <label className={styles.field}>
        Название
        <input {...register('name', { required: true })} />
      </label>

      <label className={styles.field}>
        Слаг
        <input {...register('slug', { required: true })} />
      </label>

      <label className={styles.field}>
        Родитель
        <select {...register('parentId')}>
          <option value="">— корневая —</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {'— '.repeat(category.path.split('.').length - 1)}
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" disabled={formState.isSubmitting || mutation.isPending}>
        Создать
      </button>

      {serverMessage && <p className={styles.error}>{serverMessage}</p>}
      {mutation.isSuccess && <p className={styles.ok}>Категория создана</p>}
    </form>
  );
};

export default CategoryForm;
```

- [ ] **Step 4: Форма товара**

Create `apps/web/src/features/catalog-admin/ui/ProductForm.tsx`:

```tsx
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { useCategories } from '@/entities/category/api/hook';
import { tsr } from '@/shared/api/tsr';

import { revalidateCatalog } from '../api/revalidate';
import styles from './AdminForms.module.scss';

interface ProductFormValues {
  name: string;
  categoryId: string;
  imageUrl: string;
  price: string;
  specifications: string;
}

/**
 * Характеристики вводятся построчно, «ключ: значение» — минимальный интерфейс
 * под временную админку. Строки без двоеточия молча пропускаются: падать на
 * опечатке в необязательном поле хуже, чем её проигнорировать.
 */
function parseSpecifications(raw: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const separator = line.indexOf(':');

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (key !== '' && value !== '') {
      result[key] = value;
    }
  }

  return result;
}

const ProductForm = () => {
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const { register, handleSubmit, reset, formState } = useForm<ProductFormValues>({
    defaultValues: { name: '', categoryId: '', imageUrl: '', price: '', specifications: '' },
  });

  const mutation = tsr.products.create.useMutation({
    onSuccess: async () => {
      // Префикс, а не точный ключ: список товаров закэширован под каждую
      // комбинацию категории и страницы, и какая из них затронута — неизвестно.
      await queryClient.invalidateQueries({ queryKey: ['product-list'] });
      await revalidateCatalog();
      reset();
    },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate({
      body: {
        name: values.name,
        categoryId: Number(values.categoryId),
        imageUrl: values.imageUrl,
        price: values.price === '' ? null : values.price,
        specifications: parseSpecifications(values.specifications),
      },
    });
  });

  const serverMessage =
    mutation.error && typeof mutation.error.body === 'object' && mutation.error.body !== null
      ? String((mutation.error.body as { message?: unknown }).message ?? 'Ошибка сохранения')
      : null;

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <h2>Новый товар</h2>

      <label className={styles.field}>
        Название
        <input {...register('name', { required: true })} />
      </label>

      <label className={styles.field}>
        Категория
        <select {...register('categoryId', { required: true })}>
          <option value="">— выберите —</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {'— '.repeat(category.path.split('.').length - 1)}
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        Ссылка на картинку
        <input {...register('imageUrl', { required: true })} />
      </label>

      <label className={styles.field}>
        Цена
        <input {...register('price')} placeholder="21493.96" />
      </label>

      <label className={styles.field}>
        Характеристики, по одной в строке «ключ: значение»
        <textarea rows={5} {...register('specifications')} placeholder={'Диаметр поршня, мм: 63\nХод, мм: 125'} />
      </label>

      <button type="submit" disabled={formState.isSubmitting || mutation.isPending}>
        Создать
      </button>

      {serverMessage && <p className={styles.error}>{serverMessage}</p>}
      {mutation.isSuccess && <p className={styles.ok}>Товар создан</p>}
    </form>
  );
};

export default ProductForm;
```

- [ ] **Step 5: Стили и страница**

Create `apps/web/src/features/catalog-admin/ui/AdminForms.module.scss`:

```scss
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 480px;
  padding: 16px;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}

.error {
  color: #c00;
}

.ok {
  color: #080;
}
```

Create `apps/web/src/app/admin/page.tsx`:

```tsx
import CategoryForm from '@/features/catalog-admin/ui/CategoryForm';
import ProductForm from '@/features/catalog-admin/ui/ProductForm';

/**
 * Страница намеренно без защиты — решение заказчика, зафиксированное в спеке.
 * Перед выкатом в прод закрыть обязательно: формы пишут в базу, а пишущие ручки
 * API тоже открыты.
 */
export default function AdminPage() {
  return (
    <section>
      <h1>Администрирование каталога</h1>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <CategoryForm />
        <ProductForm />
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Проверить**

Run: `nvm use && pnpm --filter @pnewmo/web typecheck && pnpm --filter @pnewmo/web build && pnpm dev`

Открыть `http://localhost:3000/admin`:
1. Создать категорию с неверным слагом (`Тест!`) — на форме появляется сообщение из контракта про строчные латинские буквы.
2. Создать категорию с верным слагом — она появляется в меню и в выпадающем списке обеих форм.
3. Создать товар в этой категории.
4. Открыть категорию на витрине — товар виден **сразу**, не через пять минут. Это проверка `revalidateTag`.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): add admin page with category and product forms"
```

---

### Task 6: Выключение json-server

**Files:**
- Modify: `turbo.json` (убрать таску `mock`)
- Modify: `apps/web/package.json` (убрать скрипт `mock` и зависимость `json-server`)
- Modify: корневой `package.json` (убрать `mock` из `dev`)
- Delete: `apps/web/db.json`
- Modify: `.claude/CLAUDE.md` (раздел «Состояние»)

- [ ] **Step 1: Убедиться, что мок больше никем не читается**

Run: `grep -rn 'localhost:3001' apps/web/src`
Expected: находки только в `entities/product/api/products.api.ts` — отцепленном коде панели фильтров.

Если находки есть где-то ещё — остановиться: значит страница осталась на моке, и выключение её сломает.

- [ ] **Step 2: Пометить отцепленный код**

В начало `apps/web/src/entities/product/api/products.api.ts` добавить:

```ts
/**
 * ОТЦЕПЛЕНО, НЕ РАБОТАЕТ. Слой запросов панели фильтров, построенный поверх
 * json-server; сам json-server выключен этапом 4b. Файл сохранён как основа для
 * переезда на реальный API — см.
 * `.claude/docs/superpowers/specs/2026-08-28-product-filter-migration-design.md`.
 *
 * Ничего отсюда не импортировать до завершения переезда: все запросы уйдут на
 * порт 3001, где никто не слушает.
 */
```

- [ ] **Step 3: Выключить**

```bash
git rm apps/web/db.json
nvm use && pnpm --filter @pnewmo/web remove json-server
```

`turbo.json` — удалить блок `"mock"`.

`apps/web/package.json` — удалить строку скрипта `"mock"`.

Корневой `package.json` — заменить:

```json
"dev": "pnpm db:up && pnpm db:sync && pnpm db:seed && turbo run dev",
```

- [ ] **Step 4: Проверить всё**

Run:
```bash
nvm use && pnpm install && pnpm typecheck && pnpm build && pnpm test
grep -rn 'localhost:3001' apps/web/src | grep -v 'products.api.ts' || echo "чисто"
```
Expected: сборка и тесты зелёные; вхождений 3001 вне отцепленного файла нет.

Run: `pnpm dev` — стек поднимается, порт 3001 не занят, витрина работает.

- [ ] **Step 5: Обновить документацию**

В `.claude/CLAUDE.md`, раздел «Состояние», заменить абзац про `json-server` и переходное состояние. Новый текст:

```markdown
Готово: монорепо и инфраструктура, категории и товары в Postgres с полным CRUD,
каталог Pneumax в сидах — 222 категории и 4842 товара, витрина читает реальный
API, админ-страница с формами создания.

Дальше: переезд панели фильтров на API (спека 4c), полнотекстовый поиск,
защита `/admin`.

`json-server` выключен, `db.json` удалён. Панель фильтров отцеплена и ждёт
переезда — код на месте, но не работает.
```

Проверить и обновить раздел «Baseline линтеров» в спеке `2026-08-11-monorepo-infra-design.md`, а также пункт 6 «Жёсткие ограничения» в `CLAUDE.md`: две ошибки eslint исчезли вместе с `useEffect`-реализацией `useCategories`. Теперь eslint проходит, а значит впервые доходит очередь до stylelint — и `pnpm lint` падает уже на его 21 ошибке. Зафиксировать новое состояние честно, замерив `pnpm lint` заново, а не переписав по памяти.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: turn off json-server, update project state"
```

---

## Self-review

- Спека, «Раскладка кода» → Task 1 Step 7, Task 2 Step 7/9. «Ключи запросов» → Task 2 Step 5/7. «Кеширование» → Task 2 Step 9. «Страница каталога» → Task 3. «Пагинация из URL» → Task 2 Step 3, Task 3 Step 3. «Меню» → Task 1. «Страница товара» → Task 4. «Админка» → Task 5. «Выключение json-server» → Task 6. «Парковка фильтров» → Task 3 Step 5, Task 6 Step 2. «Тесты» → Task 1 Step 2, Task 2 Step 1/5.
- Заглушек нет: каждый шаг содержит код или команду с ожидаемым результатом.
- Типы согласованы: `ProductListFilterState` объявлен в Task 2 Step 7 и используется в Task 2 Step 5/9 и Task 3 Step 4 с тем же набором полей. `buildProductListQueryKey` зовётся из хука и из префетча — оба в Task 2. `PRODUCTS_CACHE_TAG` объявлен в Task 2 Step 9 и потребляется в Task 5 Step 2.
- Критерий готовности спеки №9 («товар виден сразу») проверяется в Task 5 Step 6, пункт 4.
- Критерий №7 («бот видит товары») — Task 3 Step 8.
