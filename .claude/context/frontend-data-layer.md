# Слой данных: TanStack Query + ts-rest + Next.js SSR

Как в `apps/web` собран слой данных: ключ запроса, серверный префетч, кеш, ошибки.
Каждый пример — из существующего файла. За то, **где лежит файл** и как называется
компонент/слайс — скилл `component-structure`. За то, **какому слою принадлежит
хук/контейнер/презентационный компонент** — скилл `react-expert`,
`references/principles.md`. Здесь — только правила самого слоя данных: их нигде
больше не записано, а ошибки в этом слое самые тихие — не видны в Network, не ловятся
typecheck, если тест не проверяет именно то, что нужно (см. §1).

Источник правил — перенос из `panel-administration/userdata`
(`.superpowers/sdd/reference-study-query-layer.md`), сверенный с текущим кодом.

---

## 1. Два билдера: ключ запроса и тело запроса

Из `apps/web/src/entities/product/lib/queryKey.ts`:

```ts
export const PRODUCT_LIST_QUERY_KEY_PREFIX = 'product-list' as const;

export type ProductListQueryKey = readonly [typeof PRODUCT_LIST_QUERY_KEY_PREFIX, number | null, number, number];

export const buildProductListQueryKey = (filter: ProductListFilterState): ProductListQueryKey => [
  PRODUCT_LIST_QUERY_KEY_PREFIX,
  filter.categoryId ?? null,
  filter.offset,
  filter.limit,
];

export const buildProductListQuery = (filter: ProductListFilterState) => ({
  categoryId: filter.categoryId,
  offset: filter.offset,
  limit: filter.limit,
});
```

Ключ — позиционный массив с явным перечислением полей, а не `JSON.stringify(filter)`
целиком: у `JSON.stringify` результат зависит от порядка полей объекта, а сервер (в
префетче) и клиент (в хуке) собирают фильтр независимо друг от друга.

Оба билдера зовут и хук, и префетч — одни и те же функции, не два похожих места:

```ts
// entities/product/api/hook.ts
export const useProductList = (filter: ProductListFilterState) =>
  tsr.products.list.useQuery({
    queryKey: buildProductListQueryKey(filter),
    queryData: { query: buildProductListQuery(filter) },
    ...
  });

// entities/product/api/prefetch.ts
export async function prefetchProductList(queryClient: QueryClient, filter: ProductListFilterState) {
  const tsrQC = tsr.initQueryClient(queryClient);
  await tsrQC.products.list.prefetchQuery({
    queryKey: buildProductListQueryKey(filter),
    queryData: { query: buildProductListQuery(filter), fetchOptions: {...} },
  });
}
```

**Почему именно два билдера, а не «ключ = тело запроса»**: в эталоне записан инцидент
на `WorkSpaceAnchorPlanTable` — правила когда-то жили в двух независимых копиях (хук и
префетч), и копии разошлись: префетч не собирал поле `ids`, хотя `ids` входит в ключ.
Получился худший из возможных багов — не двойной запрос, а **нефильтрованная выдача
под отфильтрованным ключом**: страница с фильтром на холодной загрузке показывала
чужие строки, и по Network это не видно вовсе — запрос ровно один, просто не тот. Два
раздельных билдера убирают саму возможность разойтись: собирать поле для тела
запроса, забыв обновить ключ (или наоборот), негде — оба места читают одну функцию.

**Тест «поле в ключе ⇒ поле в теле»** — уже есть, `entities/product/lib/queryKey.spec.ts`,
`describe('buildProductListQuery')`, тест `'поля query соответствуют полям ключа'`:

```ts
it('поля query соответствуют полям ключа', () => {
  const filter: ProductListFilterState = { categoryId: 7, offset: 24, limit: 24 };
  const key = buildProductListQueryKey(filter);
  const query = buildProductListQuery(filter);

  expect([key[1], key[2], key[3]]).toEqual([query.categoryId ?? null, query.offset, query.limit]);
});
```

Ровно тот приём, ради которого в эталоне записан инцидент выше. Рядом — тест на
независимость от порядка полей во входном объекте (`'не зависит от порядка полей в
объекте-источнике'`) — вторая половина той же дисциплины позиционного ключа.

Не у каждой сущности есть оба билдера: у `entities/category/lib/queryKey.ts` есть
только ключ (`CATEGORY_LIST_QUERY_KEY`), без функции-билдера тела — у запроса списка
категорий нет параметров, собирать нечего. Заводить `buildXQuery` под пустой объект не
нужно — это тот же принцип, что и с `lib/constants.ts`, которого у entities/category
тоже нет: файл появляется, когда есть что в него положить.

---

## 2. Корневой префикс ключа и инвалидация по нему

`PRODUCT_LIST_QUERY_KEY_PREFIX` — константа, первый элемент ключа. Мутация,
меняющая список, инвалидирует по нему, а не по полному ключу с конкретной страницей/
категорией — иначе обновится кеш только той страницы каталога, на которой стоит
админ, а не всех:

```ts
// features/catalog-admin/ui/ProductForm.tsx
await queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY_PREFIX] });
```

У категорий отдельной константы-префикса нет — `CATEGORY_LIST_QUERY_KEY` сама уже
однослойный ключ (`['category-list']`, без параметров), так что инвалидация по нему
всегда точная, а префикс и полный ключ совпадают:

```ts
// features/catalog-admin/ui/CategoryForm.tsx
await queryClient.invalidateQueries({ queryKey: CATEGORY_LIST_QUERY_KEY });
```

Опечатка в строковом литерале префикса разошлась бы с литералом в `queryKey.ts` молча
— ни типы, ни тесты этого не поймают, совпадение строк для `invalidateQueries`
проверяется в рантайме. Поэтому обе стороны читают одну и ту же экспортированную
константу, а не набирают строку заново.

---

## 3. Один парсер состояния из URL — на сервере и клиенте

`entities/product/lib/parseCatalogUrlState.ts` — единственная композиция
`page`/`limit`/`offset` из query-параметров адреса. Сервер и клиент читают её через
разные обёртки, но саму композицию не повторяют:

```ts
export function parseCatalogUrlState(searchParams: Pick<URLSearchParams, 'get'>): CatalogUrlState { ... }

// Next отдаёт searchParams серверному компоненту объектом, не URLSearchParams —
// адаптер под ту же сигнатуру, а не вторая композиция по месту.
export function toSearchParamsGetter(searchParams: Record<string, string | string[] | undefined>): Pick<URLSearchParams, 'get'> { ... }
```

```ts
// entities/product/hooks/useCatalogUrlState.ts — клиент
export function useCatalogUrlState(): CatalogUrlState {
  const searchParams = useSearchParams();
  return parseCatalogUrlState(searchParams);
}
```

```ts
// app/catalog/[slug]/page.tsx — сервер
const { limit, offset } = parseCatalogUrlState(toSearchParamsGetter(rawSearchParams));
```

Слаг категории — тем же приёмом, но отдельной функцией
(`entities/category/lib/parseCategorySlugFromPath.ts` + клиентский
`useCategorySlugFromUrl`): слаг не нужен пагинации, и меню каталога (которое читает
только слаг) не обязано тянуть за собой сущность товара ради поля, которое ему не
нужно.

**Почему состояние живёт в адресе, а не в `useState`:**

1. **Паритет сервера и клиента.** Ключ запроса строится из этого состояния (§1) — если
   сервер и клиент вычисляют `offset`/`limit` по-разному, ключи расходятся, и
   гидрация молча уходит за данными второй раз (или хуже — совпадёт по кейсу и не
   совпадёт по данным, тот же класс бага, что в §1).
2. **Канонический, шаримый адрес.** `Pagination.tsx` сознательно не пишет `page=1` в
   адрес — первая страница остаётся чистым `/catalog/slug`, иначе два адреса с
   одинаковым содержимым дают дубль для поисковика.
3. **Кнопка «назад» браузера работает бесплатно.** Значение каждый раз пересчитывается
   из `searchParams` на рендере — синхронизировать нечего, потому что нечего хранить
   отдельно от адреса.

Живое подтверждение цены альтернативы — `HeaderCatalog`: подсветка активной ветки
раньше выставлялась `useEffect`'ом после монтирования, из-за чего на странице
конкретной категории меню на мгновение подсвечивало не её ветку, а первую корневую.
Перевод на вычисляемое значение из `useCategorySlugFromUrl` не только исправил это, но
и убрал сам эффект — вместе с ним ушли обе baseline-ошибки `react-hooks/set-state-in-effect`.

---

## 4. Серверный префетч

`getQueryClient` — единственный способ получить `QueryClient` на сервере:

```ts
// shared/lib/getQueryClient.ts
export const getQueryClient = cache(makeQueryClient);
```

Один клиент на серверный запрос: `cache` из React мемоизирует вызов в границах одного
рендера, все Server Components запроса получают тот же экземпляр. Без этого — либо
синглтон на модуле (данные одного посетителя утекают другому), либо новый клиент на
каждый вызов (префетч в странице и дегидратация в обёртке смотрят в разные кэши, и до
клиента не доезжает ничего).

Дегидратация сужена до `defaultShouldDehydrateQuery` — только успешные запросы:

```ts
// shared/lib/queryClient.ts
dehydrate: {
  shouldDehydrateQuery: defaultShouldDehydrateQuery,
  ...
}
```

**Почему нельзя дегидрировать незавершённые (pending) запросы** — это не
теоретическая осторожность, а зафиксированный дефект: при вложенных
`HydrationBoundary` внешняя граница дегидрировала товары ещё pending-запросом,
клала его в кэш как pending с промисом, а внутренняя граница, найдя запись уже
существующей, гидрировала свежий success через `useEffect` — который на сервере не
выполняется. Итог — HTML каталога с «Загрузка...», запечённым в разметку, то есть
**серверный HTML отдавал товары недетерминированно** в зависимости от гонки между
внешней и внутренней границей. Ни один потребитель в проекте на потоковую
(pending) гидратацию не рассчитан, поэтому `shouldDehydrateQuery` сужен, а не
расширен — расширение (`|| query.state.status === 'pending'`, как в эталоне для
Suspense-виджетов) сюда сознательно не перенесено.

---

## 5. Кеш на уровне `fetch`: теги и сброс из серверного действия

Каждый префетч вешает кеш на сам `fetch`, а не на роут:

```ts
// entities/product/api/prefetch.ts, entities/category/api/prefetch.ts
fetchOptions: { next: { revalidate: CACHE_REVALIDATE_SECONDS, tags: [PRODUCTS_CACHE_TAG] } }
```

`CACHE_REVALIDATE_SECONDS` — один источник на оба тега (`shared/lib/cacheRevalidateSeconds.ts`):
0 в разработке (иначе правка через сид или `psql` пять минут не будет видна), 300 вне
разработки. `export const revalidate` на странице/layout сюда не годится: в Next 16
`searchParams` устроен как «висящий» промис, и первое же его разворачивание помечает
доступ динамическим, выбивая страницу из статической оболочки — а пагинация каталога
без чтения `searchParams` невозможна. Кешируются данные, а не роут.

Сброс — серверное действие, а не `invalidateQueries` на клиенте (тот чистит только
кэш браузера текущего посетителя, а тег на `fetch` живёт на сервере и переживает
перезагрузку страницы):

```ts
// features/catalog-admin/api/revalidate.ts
'use server';

export async function revalidateCatalog(): Promise<void> {
  updateTag(PRODUCTS_CACHE_TAG);
  updateTag(CATEGORIES_CACHE_TAG);
}
```

`updateTag`, не `revalidateTag`: у `revalidateTag` с профилем `'max'` (дефолт Next 16)
семантика stale-while-revalidate — следующий запрос после вызова может отдать ещё
старые данные, обновление идёт в фоне (проверено запросом вживую: товар появлялся не
на первом открытии страницы, а на одном из следующих). `updateTag` вызывается только
из Server Action и истекает кеш синхронно до возврата из действия — то есть
read-your-own-writes, которое требуется: товар, созданный в админке, обязан быть
виден сразу, а не через пять минут естественного протухания кеша.

Сбрасываются оба тега разом, не только тег изменившейся сущности — функция общая для
`CategoryForm` и `ProductForm`; сброс чужого тега не бесплатен, но безопасен: это
просто более ранний повторный поход в базу, не порча данных.

---

## 6. Единая деривация состояний вместо ранних `return`

`widgets/product-grid/lib/deriveProductGridState.ts` считает три состояния из ответа
`useProductList` одной функцией вместо трёх ранних `return` внутри компонента:

```ts
export function deriveProductGridState({ isPending, data }: ProductListQueryState): ProductGridState {
  const isLoading = isPending;
  const isError = !isLoading && !isSuccessResponse(data);
  const isEmpty = !isLoading && isSuccessResponse(data) && data.body.total === 0;
  const message = isLoading ? 'Загрузка...' : isError ? 'Не удалось загрузить товары' : isEmpty ? '...' : null;

  return { isLoading, isError, isEmpty, message, data: message === null && isSuccessResponse(data) ? data.body : null };
}
```

`ProductGrid` рендерит по `message`/`data` без веток внутри тела компонента — загрузка,
ошибка и пустая категория рисуются внутри рендера, а не обрывают его тремя отдельными
`return`. Функция типизирована минимальной формой `ProductListQueryState`
(`{ isPending, data }`), не `ReturnType<typeof useProductList>` целиком — тестируется
без ts-rest и без `'use client'`, тест — `deriveProductGridState.spec.ts`.

---

## 7. Классификация ошибок API

Одна функция на всё приложение — `shared/lib/apiError.ts`:

```ts
export type ApiErrorKind = 'server' | 'notFound' | 'clientError';

export function classifyApiError(error: unknown): ApiErrorClassification {
  if (!isApiErrorResponse(error)) {
    return { kind: 'server', message: SERVER_FAILURE_MESSAGE };
  }
  if (error.status === 404) {
    return { kind: 'notFound', message: describeBody(error.body) };
  }
  if (error.status >= 500) {
    return { kind: 'server', message: SERVER_FAILURE_MESSAGE };
  }
  return { kind: 'clientError', message: describeBody(error.body) };
}
```

**Правила заказчика:**

- **5xx или сеть недоступна → `'server'`, честный 500, фиксированный текст**
  (`SERVER_FAILURE_MESSAGE = 'Проблемы на сервере, попробуйте ещё раз'`) — не
  `error.message`: сетевой сбой даёт техническое `'fetch failed'`/`'Failed to fetch'`
  (проверено вживую на обоих движках), а тело 5xx-ответа может нести подробности,
  которые посетителю не нужны. Голый `Error` без `status`/`body` (сетевой сбой) и
  ответ с `status >= 500` классифицируются одинаково — оба «сервер сейчас недоступен»
  с точки зрения посетителя.
- **404 → `'notFound'`**, вызывающая сторона зовёт `notFound()`.
- **Всё остальное (в первую очередь 400 валидации) → `'clientError'`**, текст от API
  показывается как есть, без подмены на 404 или 500 — бэкенд уже отдаёт человекочитаемый
  русский текст (`app-exception.filter.ts`), дублировать или упрощать его незачем.

Потребители ветвятся по `kind`, а не изобретают свою проверку статуса:

```ts
// app/product/[id]/page.tsx
if (classification.kind === 'notFound') notFound();
if (classification.kind === 'server') throw new Error(classification.message); // → app/error.tsx, честный 500
return <p>{classification.message}</p>; // clientError — как есть, без notFound/throw
```

```ts
// app/catalog/[slug]/page.tsx
if (productListError && productListError.kind !== 'clientError') {
  throw new Error(productListError.message); // 5xx/сеть — честный 500, не «Загрузка...» на 200
}
```

Формы админки не ветвятся по `kind` — им нужен один текст на любую ошибку мутации,
поэтому `features/catalog-admin/lib/describeServerError.ts` — тонкая обёртка,
берёт только `message`:

```ts
export function describeServerError(error: unknown): string | null {
  if (!error) return null;
  return classifyApiError(error).message;
}
```

Тесты — `shared/lib/apiError.spec.ts`: 5xx, 502 от прокси, голый `Error` (сеть), 400 с
`issues`, 400 без `issues`, 404 — каждый случай отдельным тестом на форму входа,
списанную с реального поведения ts-rest (не-2xx ответ бросается целиком как
`{status, body, headers}`, сетевой сбой — обычный `Error` без этих полей).
