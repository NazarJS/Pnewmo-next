'use client';

import { useSearchParams } from 'next/navigation';

import { parseCatalogUrlState } from '../lib/parseCatalogUrlState';
import { CatalogUrlState } from '../lib/types';

/**
 * Единственная точка чтения пагинации каталога из адреса на клиенте.
 * В hooks/, а не в lib/ рядом с чистыми функциями: хук держит React-хук
 * (useSearchParams), а lib/ этой сущности — только чистые функции без React
 * (см. отчёт задачи 3, п.6). Общий для двух widgets — product-grid
 * (offset/limit) и Pagination (page/limit) — оба зовут именно его, а не свой
 * useSearchParams, поэтому их представление адреса не может разъехаться.
 *
 * usePathname здесь больше нет: слаг категории эта пагинация не использует
 * (см. CatalogUrlState) — за ним меню каталога идёт в entities/category.
 */
export function useCatalogUrlState(): CatalogUrlState {
  const searchParams = useSearchParams();

  return parseCatalogUrlState(searchParams);
}
