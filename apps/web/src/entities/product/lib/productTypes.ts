import type { Product } from '@pnewmo/api-contract';

export type { Product };

/** Состояние списка товаров: всё, что влияет на выдачу, и ничего сверх того. */
export interface ProductListFilterState {
  categoryId: number | undefined;
  offset: number;
  limit: number;
}
