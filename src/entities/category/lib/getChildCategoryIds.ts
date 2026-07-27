import { Category } from "@/entities/category/model/types";

export default function getChildCategoryIds(categories: Category[], parentId: number): number[] {
  const ids = [parentId];

  categories.forEach((category) => {
    if (category.parent_id === parentId) {
      ids.push(
        ...getChildCategoryIds(categories, category.id)
      );
    }
  });

  return ids;
}