export interface Product {
  id: string;
  title: string;
  description: string;
  category_id: number;
  specifications: Record<string, string>;
  [key: `spec_${string}_value`]: number | undefined;
}

export interface ProductId {
  id: string;
  title: string;
  description: string;
  category_id: number;
  specifications: Record<string, string>;
}

export type FilterFiled = |
  {
      type: "range";
      key: string;
      label: string;
      unit?: string;
      min: number;
      max: number;
  } |
  {   type: "enum";
      key: string;
      label: string;
      values: string[];
  };

export type ProductFilters = Record<string, { min: number; max: number } | string[]>;
