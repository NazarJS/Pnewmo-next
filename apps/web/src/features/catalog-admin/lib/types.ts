// Типы значений форм — по образцу features/transaction/{add,edit}/lib/types.ts
// в эталоне: AddTransactionFormValues живёт в lib/types.ts, а не инлайном в
// ui/AddTransactionDialog.tsx.

export interface CategoryFormValues {
  name: string;
  slug: string;
  parentId: string;
}

export interface ProductFormValues {
  name: string;
  categoryId: string;
  imageUrl: string;
  price: string;
  specifications: string;
}
