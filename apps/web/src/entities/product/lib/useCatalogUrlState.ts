'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { parseCatalogUrlState } from './parseCatalogUrlState';
import { CatalogUrlState } from './types';

/**
 * Единственная точка чтения состояния каталога из адреса на клиенте. Живёт в
 * entities/product (не в shared/hooks): parseCatalogUrlState подставляет
 * доменные дефолты DEFAULT_PAGE/PRODUCTS_PER_PAGE, а shared не имеет права
 * зависеть от entities. Хук общий для двух widgets — product-grid (данные и
 * пагинация) и header (активная ветка меню) — оба зовут именно его, а не
 * свой usePathname/useSearchParams, поэтому их представление адреса не может
 * разъехаться.
 */
export function useCatalogUrlState(): CatalogUrlState {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return parseCatalogUrlState(pathname, searchParams);
}
