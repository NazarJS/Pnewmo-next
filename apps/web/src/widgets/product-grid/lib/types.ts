import type { Product } from '@/entities/product/lib/types';

// Пропсы виджета и его ui-подкомпонентов живут в одном lib/types.ts —
// по образцу CosmoProjectBulkActionsProps/TransactionItemFieldsProps в эталоне:
// у widget один фиксированный файл типов на весь слайс, а не по файлу на компонент.

export interface ProductGridProps {
  categoryId: number;
}

export interface ProductCardProps {
  product: Product;
}

export interface PaginationProps {
  total: number;
}
