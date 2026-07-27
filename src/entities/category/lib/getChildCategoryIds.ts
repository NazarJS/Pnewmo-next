<<<<<<< HEAD
import { Category } from "@/entities/category/model/types";

export default function getChildCategoryIds(categories: Category[], parentId: number): number[] {
  const ids = [parentId];

  categories.forEach((category) => {
    if (category.parent_id === parentId) {
      ids.push(
        ...getChildCategoryIds(categories, category.id)
      );
=======

import {Category} from "@/entities/category/model/types"

// Получаем id всех вложенных категорий
export default function getChildCategoryIds(categories: Category[], parentId: string): string[] {
  const ids = [parentId];

  categories.forEach((category) => {
    if (String(category.parent_id) === parentId) {
      ids.push(...getChildCategoryIds(categories, category.id));
>>>>>>> parent of ad69e91 (Merge pull request #16 from NazarJS/revert-15-Stas/Feature-new)
    }
  });

  return ids;
}