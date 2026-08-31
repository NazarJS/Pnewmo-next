import type { Product } from '@pnewmo/api-contract';

export type { Product };

/** Состояние списка товаров: всё, что влияет на выдачу, и ничего сверх того. */
export interface ProductListFilterState {
  categoryId: number | undefined;
  offset: number;
  limit: number;
}

/**
 * Состояние каталога, выведенное из адреса на клиенте. Слаг — единственное,
 * что читается из пути (см. parseCatalogUrlState): категорию контроллер
 * решил хранить в /catalog/[slug], а не в query.
 */
export interface CatalogUrlState {
  categorySlug: string | null;
  page: number;
  limit: number;
  offset: number;
}
