/**
 * ОТЦЕПЛЕНО, НЕ РАБОТАЕТ. Старый слой запросов категорий, построенный поверх
 * json-server; сам json-server выключен этапом 4b. Меню и страница каталога
 * давно переехали на `entities/category/api/hook.ts` и
 * `entities/category/api/prefetch.ts` (реальный API) — см.
 * `.claude/docs/superpowers/specs/2026-08-28-catalog-frontend-design.md`.
 *
 * Ничего отсюда не импортировать: все запросы уйдут на порт 3001, где никто не слушает.
 */

import { Category, CategoryDTO } from "@/entities/category/model/types";

const BASE_URL = "http://localhost:3001";

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(
    `${BASE_URL}/categories`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Ошибка загрузки категорий");
  }

  const data: CategoryDTO[] = await response.json();

  return data.map((category) => ({
    id: Number(category.id),
    parent_id:
      category.parent_id === null
        ? null
        : Number(category.parent_id),
    path: category.path,
    slug: category.slug,
    name: category.name,
    url: `/catalog/${category.slug}`,
  }));
}