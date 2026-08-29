import type { QueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { CACHE_REVALIDATE_SECONDS } from '@/shared/lib/cacheRevalidateSeconds';

import { CATEGORY_LIST_GC_TIME, CATEGORY_LIST_QUERY_KEY } from '../lib/queryKey';

/** Тег для сброса из мутаций админки — приём и имя-соглашение как у PRODUCTS_CACHE_TAG. */
export const CATEGORIES_CACHE_TAG = 'categories';

/**
 * Единственное место, где собираются fetchOptions для /categories. Тег и время
 * ревалидации задаются здесь один раз и переиспользуются и префетчем (ниже), и
 * страницей каталога (app/catalog/[slug]/page.tsx) — раньше страница делала
 * свой вызов api.categories.list() без fetchOptions вовсе, мимо кеша и тега, и
 * от дедупликации запросов Next её тоже никто не спасал: закешированный вызов
 * layout обслуживается из Data Cache и до слоя дедупликации не доходит, так что
 * у некешированного вызова страницы не с кем склеиться. Та же причина, по
 * которой страница зовёт именно эту функцию, а не свой собственный api.categories.list().
 */
export function fetchCategoryList() {
  return api.categories.list({
    fetchOptions: { next: { revalidate: CACHE_REVALIDATE_SECONDS, tags: [CATEGORIES_CACHE_TAG] } },
  });
}

/**
 * Серверный префетч. НЕ реэкспортируется из барреля: попав в клиентский бандл
 * через баррель, серверный код тянет за собой зависимости, которые в браузере
 * не работают, и ломается не на сборке, а в рантайме.
 *
 * Ключ и форма ответа обязаны совпадать с useCategories до последнего поля:
 * под этим ключом клиент будет искать готовые данные, а несовпадение обернётся
 * молчаливым повторным запросом при гидрации.
 *
 * До этой правки запрос не был кеширован вовсе: он уходит из RootLayout,
 * который ждёт его на каждой странице (см. layout.tsx), — то есть каждый
 * рендер любой страницы бил по /categories, даже там, где меню не открыто.
 * Кеш вешается на сам fetch через fetchOptions.next — тем же приёмом, что и
 * в prefetchProductList (см. entities/product/api/productPrefetch.ts) и по
 * той же причине: `export const revalidate` на layout не годится, а кешировать
 * нужно данные, а не роут.
 */
export async function prefetchCategories(queryClient: QueryClient): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: CATEGORY_LIST_QUERY_KEY,
    queryFn: fetchCategoryList,
    // Тот же gcTime, что у useCategories (см. queryKey.ts) — у этой записи
    // наблюдателя ещё нет, HeaderCatalog монтируется только по клику на
    // «Каталог». Без совпадающего значения запись жила бы по глобальному
    // дефолту и могла вычиститься из кэша раньше, чем хук успел бы её прочитать.
    gcTime: CATEGORY_LIST_GC_TIME,
  });
}
