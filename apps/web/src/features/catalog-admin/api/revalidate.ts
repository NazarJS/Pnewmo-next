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
  // В Next 16 у revalidateTag обязателен второй аргумент — профиль давности
  // кеша, который можно затронуть сбросом. Тег вешается на fetch с произвольным
  // revalidate (см. productPrefetch.ts), а не через cacheLife(), поэтому под
  // него нет предсказуемого профиля — 'max' сбрасывает тег независимо от того,
  // насколько давно кеш был свежим.
  revalidateTag(PRODUCTS_CACHE_TAG, 'max');
}
