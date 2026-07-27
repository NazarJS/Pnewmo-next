import { Product, ProductId } from "@/entities/product/model/types";


const BASE_URL = 'http://localhost:3001'

export async function getProducts(): Promise<Product[] | null> {
  const response = await fetch(`${BASE_URL}/products`);

  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function getProductId(id: string): Promise<ProductId | null> {
  const response = await fetch(`${BASE_URL}/products?id=${id}`);

  if (!response.ok) {
    return null;
  }

  const data: ProductId[] = await response.json();

  const product = data[0];

  return product ?? null;
}
