'use client';

import { tsr } from '@/shared/api/tsr';

import { mapCategory } from '../lib/mapCategory';
import { Category } from '../lib/types';
import { CATEGORY_LIST_GC_TIME, CATEGORY_LIST_QUERY_KEY } from '../lib/queryKey';

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
    // Тот же gcTime, что у prefetchCategories (см. queryKey.ts) — иначе
    // префетченная запись может вычиститься из кэша раньше, чем до неё дойдёт
    // очередь у этого наблюдателя.
    gcTime: CATEGORY_LIST_GC_TIME,
  });

  return {
    categories: data?.status === 200 ? data.body.map(mapCategory) : [],
    loading: isPending,
    error: error ? 'Ошибка загрузки категорий' : null,
  };
};
