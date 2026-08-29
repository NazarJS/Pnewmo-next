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
 */
export function resolvePage(raw: number | undefined, defaultPage: number): number {
  return raw !== undefined && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : defaultPage;
}

export function resolveLimit(raw: number | undefined, defaultLimit: number): number {
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.floor(raw), MAX_LIMIT);
}

export function toOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/** Разбор сырого значения из searchParams: массив значит повтор параметра в адресе. */
export function readNumberParam(raw: string | string[] | undefined): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === undefined ? undefined : Number(value);
}
