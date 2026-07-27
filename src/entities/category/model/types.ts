


export  interface Category {
  id: number;
  parent_id: number | null;
  path: string;
  slug: string;
  name: string;
  url?: string
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
} 


export interface CategoryDTO  {
  id: string | number;
  parent_id: string | number | null;
  path: string;
  slug: string;
  name: string;
  url: string;
}