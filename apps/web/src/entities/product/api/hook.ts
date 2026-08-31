'use client';

import { keepPreviousData } from '@tanstack/react-query';

import { tsr } from '@/shared/api/tsr';

import { ProductListFilterState } from '../lib/types';
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
