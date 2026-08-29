/** Потолок из productListQuerySchema контракта. Расхождение даст 400 от сервера. */
export const MAX_LIMIT = 100;

/**
 * Чтение пагинации из URL — чистой функцией, а не выражением в теле компонента,
 * и одной и той же на сервере и на клиенте. Расхождение здесь означает, что
 * сервер отрендерил одну страницу, а клиент после гидрации показал другую.
 *
 * Number.isFinite здесь не украшение: Number('Infinity') даёт Infinity, и
 * проверка `raw > 0` его пропускает. Правило выровнено с
 * panel-administration, shared/hooks/table/utils/pagination.ts.
 *
 * Порядок операций важен: сначала Math.floor, потом проверка границы. Раньше
 * граница проверялась до floor — вход из (0, 1), например 0.5, проходил
 * `raw > 0`, а Math.floor(0.5) давал 0 вместо дефолта. 0 уходил в
 * toOffset(0, limit) и давал отрицательный offset, который контракт
 * (`.int().gte(0)`) отвергает 400-кой. Достижимо обычным ?page=0.5.
 */
export function resolvePage(raw: number | undefined, defaultPage: number): number {
  if (raw === undefined || !Number.isFinite(raw)) {
    return defaultPage;
  }

  const page = Math.floor(raw);

  return page > 0 ? page : defaultPage;
}

/** Тот же порядок floor → граница, что и в resolvePage — см. её комментарий. */
export function resolveLimit(raw: number | undefined, defaultLimit: number): number {
  if (raw === undefined || !Number.isFinite(raw)) {
    return defaultLimit;
  }

  const limit = Math.floor(raw);

  return limit > 0 ? Math.min(limit, MAX_LIMIT) : defaultLimit;
}

export function toOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/** Разбор сырого значения из searchParams: массив значит повтор параметра в адресе. */
export function readNumberParam(raw: string | string[] | undefined): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === undefined ? undefined : Number(value);
}
