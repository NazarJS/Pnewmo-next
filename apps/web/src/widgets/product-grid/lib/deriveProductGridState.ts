import type { Product } from '@/entities/product/lib/types';

/** Суженное тело успешного ответа — ровно то, что нужно гриду для отрисовки. */
interface ProductListBody {
  items: Product[];
  total: number;
}

/**
 * Минимальная форма useProductList, которой хватает деривации: своя
 * маленькая структура, а не ReturnType<typeof useProductList> — тот же приём,
 * что deriveTableLoading(query: TableLoadingQuery) в эталоне
 * (panel-administration, shared/hooks/table/utils/deriveTableLoading.ts):
 * хелпер завязан на форму данных, а не на конкретный хук, и его можно
 * протестировать без ts-rest и без 'use client'.
 */
export interface ProductListQueryState {
  isPending: boolean;
  data: { status: 200; body: ProductListBody } | { status: number; body: unknown } | undefined;
}

export interface ProductGridState {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  /** Готовый текст для рендера; null — значит показывать сетку карточек. */
  message: string | null;
  /**
   * Суженные данные для отрисовки сетки; null ровно тогда, когда message
   * непустой. ProductGrid рендерит грид по этому полю одному — ему больше не
   * нужно самому решать data?.status === 200 повторно поверх уже готовой
   * деривации.
   */
  data: ProductListBody | null;
}

/**
 * Именованный тайп-guard, а не инлайн `data?.status === 200`: у второго
 * элемента объединения status типизирован как общий number (реальные
 * нестатусные 200-коды контракта здесь не важны), и TS из-за этого не может
 * сам вывести дизъюнктность объединения по литералу 200 — сужение `data.body`
 * без явного guard'а не срабатывает даже внутри одного && выражения.
 */
function isSuccessResponse(
  data: ProductListQueryState['data'],
): data is { status: 200; body: ProductListBody } {
  return data !== undefined && data.status === 200;
}

/**
 * Единая деривация трёх состояний вместо трёх ранних return: раньше загрузка/
 * ошибка/пустая категория рвали рендер компонента тремя отдельными return, и
 * тексты нельзя было вынести из ProductGrid, не продублировав условия. Тексты
 * дословно совпадают с прежними (уже проверены ревью).
 */
export function deriveProductGridState({ isPending, data }: ProductListQueryState): ProductGridState {
  const isLoading = isPending;
  const isError = !isLoading && !isSuccessResponse(data);
  const isEmpty = !isLoading && isSuccessResponse(data) && data.body.total === 0;

  const message = isLoading
    ? 'Загрузка...'
    : isError
      ? 'Не удалось загрузить товары'
      : isEmpty
        ? 'В этой категории пока нет товаров'
        : null;

  return {
    isLoading,
    isError,
    isEmpty,
    message,
    // message === null ровно тогда, когда isSuccessResponse(data) истинно и
    // total > 0 — но переповторять это условие незачем: guard уже сузил тип,
    // а isSuccessResponse безопасно вызвать ещё раз для сужения data.body.
    data: message === null && isSuccessResponse(data) ? data.body : null,
  };
}
