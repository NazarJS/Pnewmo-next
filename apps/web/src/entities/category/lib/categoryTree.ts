import { Category, CategoryWithChildren } from "./types";

export function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const map = new Map<number, CategoryWithChildren>();

  categories.forEach((category) => {
    map.set(category.id, {
      ...category,
      children: [],
    });
  });

  const roots: CategoryWithChildren[] = [];

  categories.forEach((category) => {
    const node = map.get(category.id)!;

    if (category.parent_id === null) {
      roots.push(node);
      return;
    }

    const parent = map.get(category.parent_id);

    if (parent) {
      parent.children.push(node);
    }
  });

  return roots;
}

export function findCategoryById(
  tree: CategoryWithChildren[],
  id: number,
): CategoryWithChildren | null {
  for (const category of tree) {
    if (category.id === id) {
      return category;
    }

    const child = findCategoryById(category.children, id);

    if (child) {
      return child;
    }
  }

  return null;
}

/**
 * Id корневой (первого уровня) категории-предка по slug открытой страницы —
 * именно её подсвечивает меню каталога: ветку первого уровня, а не саму
 * открытую (возможно, вложенную) категорию. null — когда slug не передан или
 * не найден среди категорий (страница вне /catalog/[slug]).
 */
export function findRootCategoryIdBySlug(categories: Category[], slug: string | null): number | null {
  if (slug === null) {
    return null;
  }

  const byId = new Map(categories.map((category) => [category.id, category]));
  let current = categories.find((category) => category.slug === slug);

  if (!current) {
    return null;
  }

  while (current.parent_id !== null) {
    const parent = byId.get(current.parent_id);

    if (!parent) {
      break;
    }

    current = parent;
  }

  return current.id;
}