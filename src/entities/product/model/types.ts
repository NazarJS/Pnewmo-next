



export  interface Product {
  id: string;
  title: string;
  description: string;
  category_id: number;
}


export  interface ProductId {
  id: string;
  title: string;
  description: string;
  category_id: number;
  specifications: Record<string, string>;
}
