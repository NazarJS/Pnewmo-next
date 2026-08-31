import type { Category as CategoryDto } from '@pnewmo/api-contract';

import { Category } from './types';

/**
 * Маппинг обязателен и неочевиден. API отдаёт parentId, а дерево в
 * `categoryTree.ts` и весь хедер читают parent_id — имена полей разошлись
 * исторически. Поля url в API нет вовсе, оно вычисляется из слага.
 *
 * Пропустить маппинг — получить дерево, которое собирается пустым: у всех узлов
 * parent_id окажется undefined, и ни один не попадёт в children родителя.
 */
export function mapCategory(dto: CategoryDto): Category {
  return {
    id: dto.id,
    parent_id: dto.parentId,
    path: dto.path,
    slug: dto.slug,
    name: dto.name,
    url: `/catalog/${dto.slug}`,
  };
}
