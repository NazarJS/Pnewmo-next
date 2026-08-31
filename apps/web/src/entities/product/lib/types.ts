import type { Product } from '@pnewmo/api-contract';

export type { Product };

/** Состояние списка товаров: всё, что влияет на выдачу, и ничего сверх того. */
export interface ProductListFilterState {
  categoryId: number | undefined;
  offset: number;
  limit: number;
}

/**
 * Пагинация каталога, выведенная из query-параметров адреса — то же самое,
 * что резолвит сервер для префетча (см. parseCatalogUrlState). Слаг
 * категории сюда не входит: им занимается entities/category (см.
 * parseCategorySlugFromPath) — так меню каталога не зависит от сущности
 * товара только ради поля, которое товару не нужно.
 */
export interface CatalogUrlState {
  page: number;
  limit: number;
  offset: number;
}
