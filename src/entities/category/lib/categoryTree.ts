import { Category, CategoryWithChildren } from "../model/types";

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