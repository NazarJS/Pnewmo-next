import { readNumberParam, resolveLimit, resolvePage, toOffset } from '@/shared/lib/pagination';

import { DEFAULT_PAGE, PRODUCTS_PER_PAGE } from './constants';
import { CatalogUrlState } from './types';

/**
 * Единственная композиция page/limit/offset из query-параметров адреса.
 * Сервер (app/catalog/[slug]/page.tsx, через toSearchParamsGetter ниже) и
 * клиент (entities/product/hooks/useCatalogUrlState) зовут ровно эту
 * функцию, а не readNumberParam/resolvePage/resolveLimit/toOffset каждый
 * по отдельности: разойдись порядок вызовов или имена параметров хоть в
 * одном из двух мест — сервер отрендерит одну страницу, а клиент после
 * гидрации покажет другую.
 *
 * Слаг категории сюда не входит: он не участвует в подсчёте page/limit/
 * offset и вычисляется отдельной чистой функцией
 * entities/category/lib/parseCategorySlugFromPath — так меню каталога
 * читает свою ветку, не зная о сущности товара вовсе (см. отчёт задачи 3,
 * п.6).
 */
export function parseCatalogUrlState(searchParams: Pick<URLSearchParams, 'get'>): CatalogUrlState {
  const page = resolvePage(readNumberParam(searchParams.get('page') ?? undefined), DEFAULT_PAGE);
  const limit = resolveLimit(readNumberParam(searchParams.get('limit') ?? undefined), PRODUCTS_PER_PAGE);
  const offset = toOffset(page, limit);

  return { page, limit, offset };
}

/**
 * Next.js App Router отдаёт searchParams серверному компоненту объектом
 * Record<string, string | string[] | undefined>, а не URLSearchParams.
 * Адаптер даёт app/catalog/[slug]/page.tsx звать тот же parseCatalogUrlState,
 * что и клиент, вместо повторной (и рискующей разойтись) композиции
 * readNumberParam/resolvePage/resolveLimit/toOffset по месту.
 */
export function toSearchParamsGetter(
  searchParams: Record<string, string | string[] | undefined>,
): Pick<URLSearchParams, 'get'> {
  return {
    get(key: string) {
      const value = searchParams[key];

      return (Array.isArray(value) ? value[0] : value) ?? null;
    },
  };
}
