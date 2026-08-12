# Этап 3b: фронтенд категорий — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить фронтенд к готовому API категорий: слой кеширования запросов, страница администрирования с созданием и удалением, перевод меню каталога с рукописного хука на реальный API.

**Architecture:** TanStack Query v5 с типизированной обёрткой `@ts-rest/react-query/v5`. Серверный компонент делает префетч без `await`, незавершённый запрос дегидратируется и дотекает к клиенту — стриминг стабильными средствами, без экспериментального пакета. Ключи запросов централизованы в одной фабрике, потому что в v5 они задаются руками.

**Tech Stack:** Next 16 (Turbopack), React 19.2.6, TanStack Query 5.101.4, `@ts-rest/react-query` 3.52.1, Zod 3.25.76, TypeScript 5.9.

**Спек:** `docs/superpowers/specs/2026-08-12-categories-frontend-design.md`

**Исходное состояние:** ветка `dev`, этапы 1, 2 и 3a завершены. API отдаёт `/categories` с 40 записями. Фронтенд читает каталог из json-server.

## Global Constraints

- **`HeaderCatalog.tsx` не правится.** Меняется только реализация `useCategories`, публичная форма `{ categories, loading, error }` сохраняется. Файл в зоне активной разработки NazarJS, правка даст конфликт при merge. Критерий готовности требует отсутствия файла в диффе.
- **`apps/web/src/app/catalog/[slug]/page.tsx` и `entities/category/api/category.api.ts` не правятся.** 33 из 40 идентификаторов расходятся между моком и Postgres; перевод только категорий этой страницы заставил бы её фильтровать товары мока по идентификаторам Postgres и показывать чужие товары молча.
- **`parent_id` в snake_case.** DTO контракта отдаёт `parentId`, а `buildCategoryTree` и `getChildCategoryIds` читают `category.parent_id`. Хук обязан маппить явно, иначе дерево соберётся пустым без единой ошибки.
- **Ключи запросов только из `categoryKeys`.** Расхождение ключа серверного префетча и клиентского запроса не даёт ошибки — только лишний сетевой вызов и мигание загрузки.
- **`tsr.ts` без директивы `'use client'`.** В отличие от рабочего проекта: там она нужна из-за обращений к браузерным API, а здесь серверный компонент вызывает `tsr.initQueryClient`, и директива сделала бы это невозможным.
- **Экспериментальный пакет не используется.** Стриминг — через `shouldDehydrateQuery` с включением `pending` и префетч без `await`.
- **Zod пинится на 3.25.76**, TypeScript на `^5.9.3`, версии TanStack Query задаются точно.
- **Push не выполняется**, `origin` — репозиторий тимлида.
- **`pnpm lint`** завершается с кодом 1 из-за baseline `apps/web`: 2 ошибки eslint в `HeaderCatalog.tsx` и 21 stylelint. Любая ошибка сверх этого внесена нами.

## File Structure

| Файл | Ответственность |
|---|---|
| `apps/web/src/shared/lib/queryClient.ts` | `makeQueryClient()`: политика кеша и повторов, конфигурация дегидратации, глобальная обработка ошибок |
| `apps/web/src/shared/lib/getQueryClient.ts` | `cache(makeQueryClient)` — один клиент на HTTP-запрос для серверных компонентов |
| `apps/web/src/shared/api/tsr.ts` | `initTsrReactQuery(contract, { baseUrl })`, без `'use client'` |
| `apps/web/src/shared/providers/ReactQueryProvider.tsx` | браузерный singleton, провайдеры, devtools |
| `apps/web/src/entities/category/model/keys.ts` | фабрика ключей запросов |
| `apps/web/src/entities/category/hooks/useCategories.ts` | переписывается: тот же возврат, данные из API |
| `apps/web/src/app/admin/categories/page.tsx` | серверный компонент: префетч и `HydrationBoundary` |
| `apps/web/src/features/category-admin/ui/CategoryAdmin.tsx` | композиция формы и дерева |
| `apps/web/src/features/category-admin/ui/CategoryForm.tsx` | создание категории |
| `apps/web/src/features/category-admin/ui/CategoryTree.tsx` | дерево с удалением |
| `apps/web/src/features/category-admin/hooks/useCategoryMutations.ts` | создание, удаление, инвалидация |

Слой `features` вводится впервые: `entities` описывает данные, `widgets` — секции страницы, действия пользователя над сущностью — `features`.

---

### Task 1: Проверить `@ts-rest/react-query` на React 19

Первым шагом и до написания страницы: пакет не заявляет React 19 ни в одной версии. Проверка на живом запросе через служебный роут `/dev`, который для этого и существует.

**Files:**
- Modify: `apps/web/package.json`, `apps/web/src/app/dev/page.tsx`
- Create: `apps/web/src/shared/api/tsr.ts`, `apps/web/src/shared/lib/queryClient.ts`, `apps/web/src/shared/providers/ReactQueryProvider.tsx`, `apps/web/src/app/layout.tsx` (правка)

**Interfaces:**
- Produces: `tsr` — типизированный клиент; `makeQueryClient()`; `ReactQueryProvider`. Работоспособность связки на React 19 либо подтверждена, либо зафиксирован откат.

- [ ] **Step 1: Установить зависимости и посмотреть предупреждения о пирах**

```bash
cd /Users/daniildalinchuk/My-projects/Nazz
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
pnpm --filter @pnewmo/web add @tanstack/react-query@5.101.4 @ts-rest/react-query@3.52.1
pnpm --filter @pnewmo/web add -D @tanstack/react-query-devtools@5.101.4
```

Expected: установка проходит. Предупреждение о неудовлетворённом peer `react` у `@ts-rest/react-query` ожидаемо — именно его и проверяем. Записать текст предупреждения: он понадобится в коммите.

- [ ] **Step 2: Создать `makeQueryClient`**

Create `apps/web/src/shared/lib/queryClient.ts`:

```ts
import {
  defaultShouldDehydrateQuery,
  isServer,
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';

interface TsRestError {
  status: number;
  body: Record<string, unknown>;
  headers: Headers;
}

function isTsRestError(error: unknown): error is TsRestError {
  return typeof error === 'object' && error !== null && 'status' in error && 'headers' in error;
}

/**
 * Место для подключения Sentry и всплывающих уведомлений, когда они появятся.
 * Пока сообщение уходит в консоль, но форма обработчика та же.
 */
function reportApiError(error: unknown): void {
  if (isServer) {
    return;
  }

  if (!isTsRestError(error)) {
    console.error('[api] неожиданная ошибка', error);

    return;
  }

  if (error.status === 401) {
    return;
  }

  const message = typeof error.body.message === 'string' ? error.body.message : 'Произошла ошибка';

  console.error(`[api] ${error.status}: ${message}`);
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        // 4xx не повторяем: это детерминированные ответы (валидация, доступ,
        // отсутствие записи), повтор даст тот же результат и только задержит
        // показ ошибки.
        retry: (failureCount, error) =>
          !(isTsRestError(error) && error.status < 500) && failureCount < 1,
      },
      dehydrate: {
        // Включение pending обязательно для стриминга: с TanStack Query 5.40
        // незавершённые запросы дегидратируются и дотекают к клиенту, поэтому
        // префетч без await не теряется.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
        // Next редактирует ошибки сам через digest; повторная редакция ломает
        // определение динамических страниц при отклонении стримящегося префетча.
        shouldRedactErrors: () => false,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        reportApiError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // Свой onError у мутации отключает глобальный, чтобы не показывать
        // ошибку дважды.
        if (mutation.options.onError) {
          return;
        }

        reportApiError(error);
      },
    }),
  });
}
```

- [ ] **Step 3: Создать типизированный клиент**

Create `apps/web/src/shared/api/tsr.ts`. Директивы `'use client'` здесь **нет** намеренно: серверный компонент вызывает `tsr.initQueryClient`, и директива сделала бы файл недоступным на сервере.

```ts
import { contract } from '@pnewmo/api-contract';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';

export const tsr = initTsrReactQuery(contract, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  baseHeaders: {},
});
```

- [ ] **Step 4: Создать провайдер**

Create `apps/web/src/shared/providers/ReactQueryProvider.tsx`:

```tsx
'use client';

import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';

import { tsr } from '@/shared/api/tsr';
import { makeQueryClient } from '@/shared/lib/queryClient';

interface ReactQueryProviderProps {
  children: ReactNode;
}

let browserQueryClient: QueryClient | undefined;

/**
 * На сервере — новый клиент на каждый рендер. В браузере — один на всё
 * приложение: иначе React, приостановившись при первом рендере, выбросил бы
 * созданный клиент вместе с кешем.
 */
function getBrowserQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();

  return browserQueryClient;
}

const ReactQueryProvider = ({ children }: ReactQueryProviderProps) => {
  const queryClient = getBrowserQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      <tsr.ReactQueryProvider>{children}</tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
};

export default ReactQueryProvider;
```

- [ ] **Step 5: Подключить провайдер в корневой layout**

В `apps/web/src/app/layout.tsx` обернуть содержимое `<body>`:

```tsx
import ReactQueryProvider from '@/shared/providers/ReactQueryProvider';

// ...

<body className="min-h-full flex flex-col">
  <ReactQueryProvider>
    <Header />

    <main className="main">
      <div className="container">{children}</div>
    </main>

    <Footer />
  </ReactQueryProvider>
</body>
```

- [ ] **Step 6: Переписать `/dev` на типизированный хук — это и есть проверка**

Полное содержимое `apps/web/src/app/dev/page.tsx`:

```tsx
'use client';

import { tsr } from '@/shared/api/tsr';

const DevPage = () => {
  const { data, isPending, error } = tsr.health.check.useQuery({
    queryKey: ['health'],
  });

  return (
    <section>
      <h1>Dev</h1>

      {isPending && <p>Загрузка...</p>}

      {error && <p>API недоступен</p>}

      {data?.status === 200 && (
        <p>
          API: {data.body.status}, uptime {data.body.uptime.toFixed(1)}s
        </p>
      )}
    </section>
  );
};

export default DevPage;
```

Страница перестаёт быть серверной: теперь она проверяет именно клиентский хук, что и требуется. Директива `export const dynamic` больше не нужна и удаляется.

- [ ] **Step 7: Проверить на живом запросе**

```bash
pnpm db:up
pnpm dev > /tmp/3b-dev.log 2>&1 &
sleep 32
curl -s http://localhost:3000/dev | grep -oE 'Dev|Загрузка' | head -2
```

Затем открыть `http://localhost:3000/dev` **в браузере**: серверная разметка отдаёт «Загрузка...», а данные подставляет клиентский хук, поэтому `curl` покажет только заглушку. В браузере должно появиться `API: ok, uptime N.Ns`.

Expected: страница показывает статус, в консоли браузера нет ошибок React.

Если хук падает с ошибкой вида `Cannot read properties of null (reading 'useContext')` или подобной несовместимостью — **откат**: удалить `@ts-rest/react-query`, использовать `useQuery` из TanStack Query напрямую, вызывая внутри `queryFn` клиент `initClient` из `@ts-rest/core` (он уже есть в проекте и работает). Типы при этом остаются из контракта; теряется типизированная обёртка и `tsr.ReactQueryProvider`, который в этом случае из провайдера убирается.

- [ ] **Step 8: Проверки и коммит**

```bash
pnpm --filter @pnewmo/web typecheck
pnpm --filter @pnewmo/web lint:js
```

Expected: typecheck зелёный; lint:js даёт ровно 2 прежние ошибки в `HeaderCatalog.tsx`.

```bash
git add -A
git commit -m "feat: add the TanStack Query layer with a typed ts-rest client

Ports the query client configuration from panel-administration without
Sentry, sonner, the BFF proxy or the auth redirect, none of which exist
here. Dehydration includes pending queries, which is what makes a prefetch
without await stream to the client rather than being dropped.

tsr.ts deliberately carries no 'use client': the admin page's server
component calls tsr.initQueryClient, which the directive would prevent.

The /dev route now uses the typed hook, which is how React 19 compatibility
gets verified — @ts-rest/react-query declares peers only up to React 18."
```

---

### Task 2: Фабрика ключей и перевод `useCategories`

**Files:**
- Create: `apps/web/src/entities/category/model/keys.ts`
- Modify: `apps/web/src/entities/category/hooks/useCategories.ts`, `apps/web/src/entities/category/api/category.api.ts` (только комментарий)

**Interfaces:**
- Consumes: `tsr` из Task 1.
- Produces: `categoryKeys` с полями `all` и `list()`; `useCategories()` с прежним возвратом `{ categories: Category[]; loading: boolean; error: string | null }`.

- [ ] **Step 1: Создать фабрику ключей**

Create `apps/web/src/entities/category/model/keys.ts`:

```ts
/**
 * В @ts-rest/react-query v5 ключ задаётся вручную, автоматической генерации нет.
 * Расхождение ключа серверного префетча и клиентского запроса не даёт ошибки —
 * только лишний сетевой вызов и мигание загрузки. Поэтому единственный источник.
 */
export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
};
```

- [ ] **Step 2: Зафиксировать текущую форму возврата хука**

Run: `cat apps/web/src/entities/category/hooks/useCategories.ts`

Убедиться, что возвращается ровно `{ categories, loading, error }`, и что `HeaderCatalog.tsx` использует только эти поля:

```bash
grep -n 'useCategories' -A4 apps/web/src/widgets/header/ui/header-panel/header-catalog/HeaderCatalog.tsx
```

Expected: деструктуризация только этих трёх полей. Любое другое поле означает, что форму менять нельзя иначе, чем расширением.

- [ ] **Step 3: Переписать хук**

Полное содержимое `apps/web/src/entities/category/hooks/useCategories.ts`:

```ts
'use client';

import { useMemo } from 'react';

import { tsr } from '@/shared/api/tsr';

import { categoryKeys } from '../model/keys';
import { Category } from '../model/types';

/**
 * Возвращаемая форма сохранена намеренно: HeaderCatalog.tsx находится в зоне
 * активной разработки, и менять его — значит получить конфликт при merge.
 * Меняется только источник данных.
 */
export const useCategories = () => {
  const { data, isPending, error } = tsr.categories.list.useQuery({
    queryKey: categoryKeys.list(),
  });

  const categories = useMemo<Category[]>(() => {
    if (data?.status !== 200) {
      return [];
    }

    return data.body.map((category) => ({
      id: category.id,
      // DTO контракта отдаёт parentId, а buildCategoryTree и getChildCategoryIds
      // читают parent_id. Без этого маппинга дерево соберётся пустым, и ни одной
      // ошибки при этом не будет — меню просто окажется без категорий.
      parent_id: category.parentId,
      // path в моке использовался для вычисления глубины; в реальных данных
      // не нужен и никем не читается.
      path: '',
      slug: category.slug,
      name: category.name,
      url: `/catalog/${category.slug}`,
    }));
  }, [data]);

  return {
    categories,
    loading: isPending,
    error: error ? 'Ошибка загрузки категорий' : null,
  };
};
```

- [ ] **Step 4: Объяснить в `category.api.ts`, почему его нельзя трогать**

Добавить в начало `apps/web/src/entities/category/api/category.api.ts`:

```ts
/**
 * Этот модуль обслуживает страницу /catalog/[slug] и продолжает читать данные из
 * json-server. Переводить его на реальный API нельзя: идентификаторы категорий в
 * Postgres и в моке не совпадают (замер: разошлись 33 из 40), а страница фильтрует
 * товары мока по category_id. Перевод только категорий заставил бы её показывать
 * чужие товары молча, без ошибки.
 *
 * Модуль уйдёт вместе с json-server, когда товары переедут в Postgres — этап 4.
 * Меню в шапке уже работает от реального API через useCategories.
 */
```

- [ ] **Step 5: Проверить меню без json-server**

Это главная проверка задачи: если меню работает при остановленном моке, значит данные идут из Postgres.

```bash
pkill -f json-server
sleep 1
curl -s -o /dev/null -w "json-server: %{http_code}\n" http://localhost:3001/categories
```

Expected: `json-server: 000` — мок недоступен.

Открыть `http://localhost:3000` в браузере, раскрыть меню каталога.

Expected: категории на месте, три корневых раздела — «Гидравлика», «Пневматика», «Вакуумная техника». В консоли браузера ошибок нет.

Затем вернуть мок: `pnpm --filter @pnewmo/web mock &`

- [ ] **Step 6: Проверить, что каталог по-прежнему работает**

```bash
for u in / /catalog/gidravlika /product/1; do printf "%-22s -> " "$u"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$u"; done
```

Expected: три раза `200`.

- [ ] **Step 7: Проверить, что `HeaderCatalog.tsx` не в диффе**

```bash
git status --short | grep HeaderCatalog || echo "HeaderCatalog.tsx не изменён — верно"
```

Expected: `HeaderCatalog.tsx не изменён — верно`.

- [ ] **Step 8: Проверки и коммит**

```bash
pnpm --filter @pnewmo/web typecheck && pnpm --filter @pnewmo/web lint:js
```

Expected: typecheck зелёный, lint:js — ровно 2 прежние ошибки.

```bash
git add -A
git commit -m "feat: serve the header catalogue from the real API

Only the implementation of useCategories changes; its return shape is
untouched, so HeaderCatalog.tsx — a file NazarJS is actively working in —
stays out of the diff. The hand-rolled useState/useEffect refetch on every
mount is replaced by a cached query.

The mapping is not cosmetic: the contract DTO returns parentId while
buildCategoryTree reads parent_id, and getting it wrong builds an empty tree
with no error at all.

category.api.ts keeps reading json-server and now says why: 33 of 40
category ids differ between the mock and Postgres, so migrating only the
catalogue page's categories would filter mock products by Postgres ids."
```

---

### Task 3: Страница администрирования, чтение

Сначала только отображение дерева с серверным префетчем. Формы и удаление — следующие задачи: так проверяемо, что префетч работает, до появления мутаций.

**Files:**
- Create: `apps/web/src/app/admin/categories/page.tsx`, `apps/web/src/features/category-admin/ui/CategoryAdmin.tsx`, `apps/web/src/features/category-admin/ui/CategoryTree.tsx`, `apps/web/src/features/category-admin/ui/CategoryTree.module.scss`
- Create: `apps/web/src/shared/lib/getQueryClient.ts`

**Interfaces:**
- Consumes: `tsr`, `makeQueryClient`, `categoryKeys`.
- Produces: `getQueryClient()`; страница `/admin/categories`; компонент `CategoryTree` с необязательным пропом `onDelete`.

- [ ] **Step 1: Создать request-scoped клиент для серверных компонентов**

Create `apps/web/src/shared/lib/getQueryClient.ts`:

```ts
import { cache } from 'react';

import { makeQueryClient } from './queryClient';

/**
 * Один QueryClient на HTTP-запрос: layout, страница и виджеты делят кеш, поэтому
 * одинаковые префетчи дедуплицируются в один сетевой вызов, а между запросами
 * данные не утекают.
 *
 * Используется только в серверных компонентах. В браузере свой singleton живёт
 * в ReactQueryProvider.
 */
export const getQueryClient = cache(makeQueryClient);
```

- [ ] **Step 2: Создать компонент дерева**

Create `apps/web/src/features/category-admin/ui/CategoryTree.tsx`:

```tsx
'use client';

import { buildCategoryTree } from '@/entities/category/lib/categoryTree';
import { Category, CategoryWithChildren } from '@/entities/category/model/types';

import styles from './CategoryTree.module.scss';

interface CategoryTreeProps {
  categories: Category[];
  onDelete?: (id: number) => void;
  deletingId?: number | null;
}

interface CategoryNodeProps {
  node: CategoryWithChildren;
  depth: number;
  onDelete?: (id: number) => void;
  deletingId?: number | null;
}

const CategoryNode = ({ node, depth, onDelete, deletingId }: CategoryNodeProps) => (
  <li>
    <div className={styles.row} style={{ paddingLeft: `${depth * 20}px` }}>
      <span className={styles.name}>{node.name}</span>
      <code className={styles.slug}>{node.slug}</code>

      {onDelete && (
        <button
          type="button"
          className={styles.delete}
          onClick={() => onDelete(node.id)}
          disabled={deletingId === node.id}
        >
          {deletingId === node.id ? 'Удаляю...' : 'Удалить'}
        </button>
      )}
    </div>

    {node.children.length > 0 && (
      <ul className={styles.list}>
        {node.children.map((child) => (
          <CategoryNode
            key={child.id}
            node={child}
            depth={depth + 1}
            onDelete={onDelete}
            deletingId={deletingId}
          />
        ))}
      </ul>
    )}
  </li>
);

const CategoryTree = ({ categories, onDelete, deletingId }: CategoryTreeProps) => {
  const tree = buildCategoryTree(categories);

  if (tree.length === 0) {
    return <p>Категорий нет</p>;
  }

  return (
    <ul className={styles.list}>
      {tree.map((node) => (
        <CategoryNode
          key={node.id}
          node={node}
          depth={0}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}
    </ul>
  );
};

export default CategoryTree;
```

Create `apps/web/src/features/category-admin/ui/CategoryTree.module.scss`:

```scss
.list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}

.name {
  font-weight: 500;
}

.slug {
  color: #888;
  font-size: 12px;
}

.delete {
  margin-left: auto;
  cursor: pointer;
}
```

Порядок свойств внутри правил соответствует конфигурации stylelint проекта: `display` и flex-свойства раньше отступов, цвет раньше размера шрифта. Проверяется командой `lint:css` в шаге 6.

- [ ] **Step 3: Создать композицию**

Create `apps/web/src/features/category-admin/ui/CategoryAdmin.tsx`:

```tsx
'use client';

import { useCategories } from '@/entities/category/hooks/useCategories';

import CategoryTree from './CategoryTree';

const CategoryAdmin = () => {
  const { categories, loading, error } = useCategories();

  if (loading) {
    return <p>Загрузка категорий...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <section>
      <h1>Категории</h1>

      <p>Всего: {categories.length}</p>

      <CategoryTree categories={categories} />
    </section>
  );
};

export default CategoryAdmin;
```

- [ ] **Step 4: Создать страницу с префетчем**

Create `apps/web/src/app/admin/categories/page.tsx`:

```tsx
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { categoryKeys } from '@/entities/category/model/keys';
import CategoryAdmin from '@/features/category-admin/ui/CategoryAdmin';
import { tsr } from '@/shared/api/tsr';
import { getQueryClient } from '@/shared/lib/getQueryClient';

const AdminCategoriesPage = () => {
  // getQueryClient, а не new QueryClient(): нужна наша конфигурация дегидратации,
  // иначе незавершённый запрос не попадёт к клиенту и префетч будет потерян.
  const tsrQueryClient = tsr.initQueryClient(getQueryClient());

  // Без await намеренно: запрос стартует, рендер не блокируется, а результат
  // дотекает к клиенту по готовности.
  void tsrQueryClient.categories.list.prefetchQuery({ queryKey: categoryKeys.list() });

  return (
    <HydrationBoundary state={dehydrate(tsrQueryClient)}>
      <CategoryAdmin />
    </HydrationBoundary>
  );
};

export default AdminCategoriesPage;
```

Если `dehydrate(tsrQueryClient)` не пройдёт проверку типов — обёртка ts-rest окажется не совместимой с `QueryClient` по типу, — сохранить ссылку на нижележащий клиент и дегидратировать его:

```tsx
const queryClient = getQueryClient();
const tsrQueryClient = tsr.initQueryClient(queryClient);

void tsrQueryClient.categories.list.prefetchQuery({ queryKey: categoryKeys.list() });

// dehydrate(queryClient) вместо dehydrate(tsrQueryClient)
```

Данные пишутся в один и тот же кеш, поэтому результат идентичен.

- [ ] **Step 5: Проверить, что страница показывает данные**

```bash
pnpm db:up
pnpm dev > /tmp/3b-admin.log 2>&1 &
sleep 32
curl -s http://localhost:3000/admin/categories > /tmp/admin.html
grep -c 'Загрузка категорий' /tmp/admin.html
grep -c 'Гидравлика' /tmp/admin.html
```

Expected: первая команда — не ноль, вторая — тоже не ноль.

Оба результата важны и не противоречат друг другу. `useQuery` не приостанавливает рендер, поэтому **видимая** разметка содержит состояние загрузки — это нормально, а не признак поломки. Название при этом присутствует в дегидратированном состоянии, которое дотекает в том же ответе: именно оно доказывает, что префетч сработал.

Если название отсутствует, а состояние загрузки есть — префетч потерян. Первое, что проверить: ключи в `page.tsx` и в `useCategories` должны совпадать посимвольно.

- [ ] **Step 6: Проверить, что префетч избавил от клиентского запроса**

Открыть `http://localhost:3000/admin/categories` в браузере с открытой панелью Network, фильтр по `categories`.

Expected: запроса к `localhost:4000/categories` из браузера **нет** — данные пришли дегидратированными вместе с разметкой.

Это единственный способ отличить работающий префетч от неработающего: страница выглядит одинаково в обоих случаях. Если запрос есть — сверить ключ в `page.tsx` и в `useCategories`: они обязаны совпадать посимвольно.

- [ ] **Step 7: Проверки и коммит**

```bash
pnpm --filter @pnewmo/web typecheck
pnpm --filter @pnewmo/web lint:js
pnpm --filter @pnewmo/web lint:css
```

Expected: typecheck зелёный; `lint:js` — 2 прежние ошибки; `lint:css` — 21 прежняя ошибка и ни одной в новых файлах. Если в `CategoryTree.module.scss` есть замечания, исправить их: baseline не покрывает файлы, которых в нём не было.

```bash
git add -A
git commit -m "feat: add the admin categories page with a server prefetch

The page prefetches without awaiting, so the pending query dehydrates and
streams to the client instead of blocking the render. It uses the
request-scoped client rather than a bare QueryClient, because the pending
dehydration lives in our configuration.

Verified the prefetch actually lands: the category name appears in the
server-rendered markup, and the browser makes no request to /categories.
That check is the only way to tell a working prefetch from a broken one —
the page looks identical either way."
```

---

### Task 4: Форма создания категории

**Files:**
- Create: `apps/web/src/features/category-admin/hooks/useCategoryMutations.ts`, `apps/web/src/features/category-admin/ui/CategoryForm.tsx`, `apps/web/src/features/category-admin/ui/CategoryForm.module.scss`
- Modify: `apps/web/src/features/category-admin/ui/CategoryAdmin.tsx`

**Interfaces:**
- Consumes: `tsr`, `categoryKeys`, `createCategorySchema` из контракта.
- Produces: `useCategoryMutations()` возвращает `{ create, remove }` — объекты мутаций TanStack Query.

- [ ] **Step 1: Создать хук мутаций**

Create `apps/web/src/features/category-admin/hooks/useCategoryMutations.ts`:

```ts
'use client';

import { useQueryClient } from '@tanstack/react-query';

import { categoryKeys } from '@/entities/category/model/keys';
import { tsr } from '@/shared/api/tsr';

/**
 * Оптимистичных обновлений нет намеренно: список из сорока элементов
 * перезапрашивается мгновенно, а оптимистичное обновление дерева с проверкой
 * инвариантов на клиенте — источник рассинхрона с сервером.
 */
export const useCategoryMutations = () => {
  const queryClient = useQueryClient();

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
  };

  const create = tsr.categories.create.useMutation({ onSuccess: invalidate });
  const remove = tsr.categories.remove.useMutation({ onSuccess: invalidate });

  return { create, remove };
};
```

Свой `onError` не задаётся: тогда срабатывает глобальный обработчик из `MutationCache`, и ошибка попадает в консоль один раз, а не дважды.

- [ ] **Step 2: Создать форму**

Create `apps/web/src/features/category-admin/ui/CategoryForm.tsx`:

```tsx
'use client';

import { createCategorySchema } from '@pnewmo/api-contract';
import { FormEvent, useState } from 'react';

import { buildCategoryTree } from '@/entities/category/lib/categoryTree';
import { Category, CategoryWithChildren } from '@/entities/category/model/types';

import { useCategoryMutations } from '../hooks/useCategoryMutations';

import styles from './CategoryForm.module.scss';

interface CategoryFormProps {
  categories: Category[];
}

interface Option {
  id: number;
  label: string;
}

/** Плоский список с отступами по уровню — для select выбора родителя. */
function toOptions(nodes: CategoryWithChildren[], depth = 0): Option[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${'— '.repeat(depth)}${node.name}` },
    ...toOptions(node.children, depth + 1),
  ]);
}

const CategoryForm = ({ categories }: CategoryFormProps) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { create } = useCategoryMutations();
  const options = toOptions(buildCategoryTree(categories));

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setLocalError(null);

    const input = {
      name,
      slug,
      parentId: parentId === '' ? null : Number(parentId),
    };

    // Та же схема, которой валидирует сервер: одна форма правил на обе стороны.
    const parsed = createCategorySchema.safeParse(input);

    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'Некорректные данные');

      return;
    }

    create.mutate(
      { body: parsed.data },
      {
        onSuccess: () => {
          setName('');
          setSlug('');
          setParentId('');
        },
      },
    );
  };

  const serverError =
    create.error && 'body' in create.error && typeof create.error.body?.message === 'string'
      ? create.error.body.message
      : null;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        Название
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>

      <label className={styles.field}>
        Slug
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="gidravlika"
          required
        />
      </label>

      <label className={styles.field}>
        Родитель
        <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
          <option value="">Корневая категория</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" disabled={create.isPending}>
        {create.isPending ? 'Создаю...' : 'Создать'}
      </button>

      {localError && <p className={styles.error}>{localError}</p>}
      {!localError && serverError && <p className={styles.error}>{serverError}</p>}
    </form>
  );
};

export default CategoryForm;
```

Обратить внимание: `onSuccess` у самого вызова `mutate` не отменяет `onSuccess` из `useMutation` — оба выполняются, поэтому инвалидация не теряется. А вот `onError` на уровне `useMutation` отключил бы глобальный обработчик, поэтому его там нет.

Create `apps/web/src/features/category-admin/ui/CategoryForm.module.scss`:

```scss
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 420px;
  margin-bottom: 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error {
  margin: 0;
  color: #c00;
}
```

- [ ] **Step 3: Подключить форму**

В `apps/web/src/features/category-admin/ui/CategoryAdmin.tsx` добавить импорт и вставить форму перед деревом:

```tsx
import CategoryForm from './CategoryForm';

// внутри return, перед <CategoryTree ...>:
<CategoryForm categories={categories} />
```

- [ ] **Step 4: Проверить создание**

Открыть `http://localhost:3000/admin/categories` в браузере.

| Действие | Ожидание |
|---|---|
| Название «Питатели», slug `pitateli`, родитель «— Смазочная техника» | категория появляется в дереве под выбранным родителем, счётчик становится 41, страница не перезагружается |
| Повторить с тем же slug | сообщение «Запись с таким значением уже существует», дерево не меняется |
| Slug `Bad Slug` | сообщение про допустимые символы **до** отправки: в панели Network запроса к API нет |
| Пустое название | браузер не даёт отправить форму (атрибут `required`) |

Третья проверка важна отдельно: она подтверждает, что схема контракта работает и на клиенте, а не только на сервере.

- [ ] **Step 5: Убрать тестовую категорию**

```bash
pnpm db:psql -tAc "DELETE FROM categories WHERE slug = 'pitateli';"
pnpm db:psql -tAc "SELECT count(*) FROM categories;"
```

Expected: `40`.

- [ ] **Step 6: Проверки и коммит**

```bash
pnpm --filter @pnewmo/web typecheck
pnpm --filter @pnewmo/web lint:js
pnpm --filter @pnewmo/web lint:css
```

Expected: typecheck зелёный, ошибок сверх baseline нет.

```bash
git add -A
git commit -m "feat: add the category creation form

Validates with createCategorySchema from the contract — the same schema the
server validates with, so a bad slug is rejected before a request is made
and the rule is stated once.

No form library: three fields do not need one, and the contract schema
already covers validation. No optimistic update either — forty rows refetch
instantly, and optimistically mutating a tree while checking invariants on
the client invites drift."
```

---

### Task 5: Удаление категории

**Files:**
- Modify: `apps/web/src/features/category-admin/ui/CategoryAdmin.tsx`, `apps/web/src/features/category-admin/ui/CategoryTree.tsx`, `apps/web/src/features/category-admin/ui/CategoryTree.module.scss`

**Interfaces:**
- Consumes: `useCategoryMutations().remove`.
- Produces: удаление из дерева с двухшаговым подтверждением.

- [ ] **Step 1: Добавить двухшаговое подтверждение в дерево**

`window.confirm` не используется: браузерный диалог блокирует поток и мешает автоматизации. Вместо него кнопка меняет надпись, и удаление происходит по второму нажатию.

В `CategoryTree.tsx` заменить блок кнопки в `CategoryNode` на состояние подтверждения. Полное содержимое `CategoryNode`:

```tsx
const CategoryNode = ({ node, depth, onDelete, deletingId }: CategoryNodeProps) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <li>
      <div className={styles.row} style={{ paddingLeft: `${depth * 20}px` }}>
        <span className={styles.name}>{node.name}</span>
        <code className={styles.slug}>{node.slug}</code>

        {onDelete && (
          <button
            type="button"
            className={confirming ? styles.confirm : styles.delete}
            onClick={() => {
              if (confirming) {
                onDelete(node.id);
                setConfirming(false);

                return;
              }

              setConfirming(true);
            }}
            onBlur={() => setConfirming(false)}
            disabled={deletingId === node.id}
          >
            {deletingId === node.id ? 'Удаляю...' : confirming ? 'Точно удалить?' : 'Удалить'}
          </button>
        )}
      </div>

      {node.children.length > 0 && (
        <ul className={styles.list}>
          {node.children.map((child) => (
            <CategoryNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onDelete={onDelete}
              deletingId={deletingId}
            />
          ))}
        </ul>
      )}
    </li>
  );
};
```

Добавить импорт `useState` из `react`.

Добавить в `CategoryTree.module.scss`:

```scss
.confirm {
  margin-left: auto;
  color: #c00;
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 2: Подключить удаление**

Полное содержимое `apps/web/src/features/category-admin/ui/CategoryAdmin.tsx`:

```tsx
'use client';

import { useCategories } from '@/entities/category/hooks/useCategories';

import { useCategoryMutations } from '../hooks/useCategoryMutations';

import CategoryForm from './CategoryForm';
import CategoryTree from './CategoryTree';

const CategoryAdmin = () => {
  const { categories, loading, error } = useCategories();
  const { remove } = useCategoryMutations();

  if (loading) {
    return <p>Загрузка категорий...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  const removeError =
    remove.error && 'body' in remove.error && typeof remove.error.body?.message === 'string'
      ? remove.error.body.message
      : null;

  return (
    <section>
      <h1>Категории</h1>

      <p>Всего: {categories.length}</p>

      <CategoryForm categories={categories} />

      {removeError && <p role="alert">{removeError}</p>}

      <CategoryTree
        categories={categories}
        onDelete={(id) => remove.mutate({ params: { id } })}
        deletingId={
          remove.isPending && remove.variables ? Number(remove.variables.params.id) : null
        }
      />
    </section>
  );
};

export default CategoryAdmin;
```

- [ ] **Step 3: Проверить удаление**

Открыть `http://localhost:3000/admin/categories`.

| Действие | Ожидание |
|---|---|
| Создать «Тест» со slug `test-delete`, родитель корневой | появилась в дереве |
| Нажать «Удалить» у неё | надпись меняется на «Точно удалить?» |
| Нажать ещё раз | категория исчезает из дерева, счётчик уменьшается |
| Нажать «Удалить» у «Гидравлики», подтвердить | сообщение «Нельзя удалить категорию: у неё N подкатегорий», дерево не меняется |
| Нажать «Удалить» и щёлкнуть мимо | надпись возвращается к «Удалить» |

Четвёртая проверка наглядно показывает, зачем в схеме `onDelete: Restrict`: без него исчезли бы четыре уровня каталога.

- [ ] **Step 4: Убедиться, что данные целы**

```bash
pnpm db:psql -tAc "SELECT count(*) FROM categories;"
```

Expected: `40`. Если больше или меньше — убрать лишнее или выполнить `pnpm db:seed`.

- [ ] **Step 5: Проверки и коммит**

```bash
pnpm --filter @pnewmo/web typecheck
pnpm --filter @pnewmo/web lint:js
pnpm --filter @pnewmo/web lint:css
```

```bash
git add -A
git commit -m "feat: delete categories from the admin page

Confirmation is a second click on the button rather than window.confirm: a
browser dialog blocks the thread and breaks automation.

Deleting a category that has children surfaces the 409 with its count,
which demonstrates what onDelete: Restrict is for — without it, four levels
of the catalogue would disappear."
```

---

### Task 6: Прогон критериев готовности

**Files:** изменений нет, только проверка.

- [ ] **Step 1: Полный прогон проверок**

```bash
cd /Users/daniildalinchuk/My-projects/Nazz
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
pnpm typecheck
pnpm build
pnpm test
pnpm --filter @pnewmo/api test:e2e
pnpm lint; echo "lint exit: $? (1 ожидаем)"
```

Expected: всё зелёное кроме `lint`, который даёт ровно baseline: 2 ошибки eslint и 21 stylelint, все в существующих файлах `apps/web`.

- [ ] **Step 2: Проверить, что файлы NazarJS не тронуты**

```bash
git diff --name-only main..dev -- apps/web/src/widgets/ apps/web/src/app/catalog/ apps/web/src/entities/category/api/
```

Expected: только `apps/web/src/entities/category/api/category.api.ts` (добавлен комментарий). Файлов из `widgets/` и `app/catalog/` быть не должно.

- [ ] **Step 3: Проверить маршруты**

```bash
pnpm db:up
pnpm dev > /tmp/3b-final.log 2>&1 &
sleep 34
for u in / /dev /admin/categories /catalog/gidravlika /product/1; do printf "  %-22s -> " "$u"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$u"; done
printf "  api/categories         -> "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/categories
```

Expected: шесть раз `200`.

- [ ] **Step 4: Проверить меню при остановленном моке**

```bash
pkill -f json-server; sleep 1
curl -s http://localhost:3000 | grep -c 'Гидравлика'
```

Expected: не ноль — меню в шапке рендерится из Postgres.

Затем вернуть мок: `pnpm --filter @pnewmo/web mock > /dev/null 2>&1 &`

- [ ] **Step 5: Пройти по списку критериев спека**

Открыть в браузере и сверить все двенадцать критериев из раздела «Критерии готовности» спека `2026-08-12-categories-frontend-design.md`. Критерии 1–6 и 8 проверяются только глазами и панелью Network.

- [ ] **Step 6: Прибрать процессы и проверить состояние базы**

```bash
for p in 3000 3001 4000; do for pid in $(lsof -tiTCP:$p -sTCP:LISTEN 2>/dev/null); do kill $pid 2>/dev/null; done; done
pnpm db:psql -tAc "SELECT count(*) FROM categories;"
git status --short
```

Expected: `40` категорий, чистое дерево.

---

## Self-review: покрытие спека

| Требование спека | Задача |
|---|---|
| `makeQueryClient` с политикой повторов и дегидратацией | Task 1 |
| `getQueryClient` через `cache()` | Task 3 |
| `tsr` без `'use client'` | Task 1 |
| Провайдер с devtools | Task 1 |
| Проверка React 19 с откатом | Task 1 |
| Фабрика ключей | Task 2 |
| Перевод `useCategories` с маппингом `parent_id` | Task 2 |
| Комментарий в `category.api.ts` | Task 2 |
| Страница `/admin/categories` с префетчем без `await` | Task 3 |
| Дерево с отступами | Task 3 |
| Форма с выбором родителя и локальной валидацией схемой контракта | Task 4 |
| Мутации с инвалидацией | Task 4, Task 5 |
| Удаление без `window.confirm` | Task 5 |
| Критерий «нет клиентского запроса при префетче» | Task 3, Step 6 |
| Критерий «`HeaderCatalog.tsx` не в диффе» | Task 2 Step 7, Task 6 Step 2 |
| Все двенадцать критериев готовности | Task 6 |

## Что осознанно не делается

- Редактирование категории через интерфейс: эндпоинт `update` готов и покрыт тестами, форма — отдельная задача.
- Оптимистичные обновления.
- Библиотека форм.
- Авторизация страницы `/admin`: её нет во всём проекте. Перед любым выходом в сеть страницу необходимо закрыть — зафиксировано в спеке как условие этапа деплоя.
- Юнит-тесты фронтенда: инфраструктуры для них в проекте нет, вводить её ради этого этапа преждевременно.
- Перевод `/catalog/[slug]` на реальный API — этап 4, вместе с товарами.
- Фронтенд-ревьюер из этапа 2: пишется после этого этапа, когда появится реальный код запросов и мутаций.
