import { Category, CategoryDTO } from "@/entities/category/model/types";

const BASE_URL = "http://localhost:3001";

export async function getCategories(): Promise<Category[] | null> {
  const response = await fetch(`${BASE_URL}/categories`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${BASE_URL}/categories`);

  if (!response.ok) {
    throw new Error("Ошибка загрузки категорий");
  }
  const data: CategoryDTO[] = await response.json();
  
  return data.map((category) => ({
          id: Number(category.id),
          parent_id: category.parent_id === null ? null : Number(category.parent_id),
          path: category.path,
          slug: category.slug,
          name: category.name,
          url: `/catalog/${category.slug}`,
        }));
}
