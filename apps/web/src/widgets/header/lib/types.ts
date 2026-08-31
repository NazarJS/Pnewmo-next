import type { Ref } from 'react';

import type { CategoryWithChildren } from '@/entities/category/lib/types';

// Один файл на весь виджет header, как ProductGridProps/ProductCardProps в
// widgets/product-grid/lib/types.ts: несмотря на глубину вложенности (до
// пяти уровней у header-catalog/ui/*), пропсов всего семь — дробить по
// подпапкам рано, один файл читается целиком за секунды.

export interface HeaderCatalogProps {
  showSearch?: boolean;
  isOpen: boolean;
  onClose?: () => void;
  mobile?: boolean;
}

// Исходное имя в HeaderFavorites.tsx было `onClickProps` — переименовано в
// HeaderFavoritesProps, иначе оно бы столкнулось с одноимённым (но другим по
// форме) типом из CatalogButton.tsx в общем файле.
export interface HeaderFavoritesProps {
  onCatalogClick: () => void;
  isMobileCatalogOpen: boolean;
}

export interface HeaderInputProps {
  ref?: Ref<HTMLInputElement>;
  onClose?: () => void;
}

// Исходное имя в CatalogButton.tsx было `onClickProps` — та же причина
// переименования, что и у HeaderFavoritesProps выше.
export interface CatalogButtonProps {
  isOpen: boolean;
  onClick?: () => void;
}

export interface CategoryItemProps {
  category: CategoryWithChildren;
  isActive: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  onClose?: () => void;
}

export interface MegaMenuProps {
  category: CategoryWithChildren;
  onClick?: () => void;
  onClose?: () => void;
}

export interface MobileSubcategoriesProps {
  category: CategoryWithChildren;
  onClose?: () => void;
}
