import { readNumberParam, resolveLimit, resolvePage, toOffset } from '@/shared/lib/pagination';

import { DEFAULT_PAGE, PRODUCTS_PER_PAGE } from './constants';
import { CatalogUrlState } from './types';

/** /catalog/[slug] — слаг всегда первый сегмент сразу после /catalog. */
const CATALOG_PATH_PATTERN = /^\/catalog\/([^/]+)/;

/**
 * Чистая функция, без хуков next/navigation внутри — та же связка
 * readNumberParam/resolvePage/resolveLimit/toOffset, которой app/catalog/[slug]/page.tsx
 * резолвит page/offset/limit для префетча. Второй, независимой реализации
 * разбора здесь нет и не должно быть: разойдись она с серверной хоть в одном
 * поле — клиент при гидрации либо тихо перезапросит те же данные под другим
 * ключом, либо (хуже) увидит чужие данные под ключом, который совпал случайно.
 *
 * usePathname/useSearchParams вынесены в useCatalogUrlState.ts, чтобы эту
 * функцию можно было тестировать в testEnvironment: 'node' без React и DOM.
 */
export function parseCatalogUrlState(
  pathname: string,
  searchParams: Pick<URLSearchParams, 'get'>,
): CatalogUrlState {
  const categorySlug = pathname.match(CATALOG_PATH_PATTERN)?.[1] ?? null;

  const page = resolvePage(readNumberParam(searchParams.get('page') ?? undefined), DEFAULT_PAGE);
  const limit = resolveLimit(readNumberParam(searchParams.get('limit') ?? undefined), PRODUCTS_PER_PAGE);
  const offset = toOffset(page, limit);

  return { categorySlug, page, limit, offset };
}
