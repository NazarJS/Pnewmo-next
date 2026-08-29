import { ProductListFilterState } from './productTypes';

/**
 * Ключ — позиционный массив с явным перечислением полей, а не
 * JSON.stringify(filter) целиком.
 *
 * У JSON.stringify результат зависит от порядка полей объекта: два
 * семантически одинаковых фильтра, собранных в разном порядке — сервером в
 * префетче и клиентом в хуке, — дают разные строки. Страница при гидрации
 * молча уходит за данными второй раз, и заметить это в Network невозможно:
 * лишнего запроса не видно, просто данные оказываются не те.
 *
 * Правило и его обоснование взяты из panel-administration,
 * entities/pbn-pool/lib/queryKey.ts.
 */
export type ProductListQueryKey = readonly ['product-list', number | null, number, number];

export const buildProductListQueryKey = (filter: ProductListFilterState): ProductListQueryKey => [
  'product-list',
  filter.categoryId ?? null,
  filter.offset,
  filter.limit,
];

/**
 * Единственная точка сборки query из фильтра — общая для useProductList и
 * prefetchProductList. Два независимых маппинга однажды разойдутся: достаточно
 * забыть поле при добавлении фильтра, и под одинаковым ключом закэшируется
 * другая выдача.
 */
export const buildProductListQuery = (filter: ProductListFilterState) => ({
  categoryId: filter.categoryId,
  offset: filter.offset,
  limit: filter.limit,
});
