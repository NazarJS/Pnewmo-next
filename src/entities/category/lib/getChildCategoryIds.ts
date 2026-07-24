
import {Category} from "@/entities/category/model/types"

// Получаем id всех вложенных категорий
export default function getChildCategoryIds(categories: Category[], parentId: string): string[] {
  const ids = [parentId];

  categories.forEach((category) => {
    if (String(category.parent_id) === parentId) {
      ids.push(...getChildCategoryIds(categories, category.id));
    }
  });

  return ids;
}