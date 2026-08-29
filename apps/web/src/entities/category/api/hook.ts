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
 *
 * Заодно уходит причина двух ошибок react-hooks/set-state-in-effect из baseline
 * линтеров: setState в теле эффекта больше нет.
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
