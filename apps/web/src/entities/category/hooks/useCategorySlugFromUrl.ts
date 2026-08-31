'use client';

import { usePathname } from 'next/navigation';

import { parseCategorySlugFromPath } from '../lib/parseCategorySlugFromPath';

/**
 * Единственная точка чтения текущей ветки каталога из адреса на клиенте для
 * меню. Живёт в entities/category (не в entities/product и не в
 * shared/hooks): парсер здесь — без доменных дефолтов пагинации, которые
 * нужны только товару, поэтому меню каталога (widgets/header) может зависеть
 * от сущности category и не зависеть от сущности product — раньше
 * зависело, см. отчёт задачи 3, п.6.
 */
export function useCategorySlugFromUrl(): string | null {
  const pathname = usePathname();

  return parseCategorySlugFromPath(pathname);
}
