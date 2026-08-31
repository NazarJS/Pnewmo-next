/** /catalog/[slug] — слаг всегда первый сегмент сразу после /catalog. */
const CATALOG_PATH_PATTERN = /^\/catalog\/([^/]+)/;

/**
 * Слаг категории из пути страницы. Раньше был частью
 * entities/product/lib/parseCatalogUrlState — вместе с page/limit/offset,
 * которые слагу не нужны. Меню каталога (widgets/header) тянуло оттуда весь
 * пакет ради одного поля и заодно зависело от сущности товара безо всякой
 * причины. Здесь — без пагинации и без entities/product (см. отчёт задачи 3,
 * п.6): чистая функция, без React, decodeURIComponent — сегмент пути
 * приходит percent-encoded (кириллический слаг, если он когда-нибудь
 * появится), а Category.slug в базе — обычная строка; без декодирования
 * сравнение со slug категории в findRootCategoryIdBySlug молча не совпадёт
 * ни с одной категорией.
 */
export function parseCategorySlugFromPath(pathname: string): string | null {
  const rawSlug = pathname.match(CATALOG_PATH_PATTERN)?.[1];

  return rawSlug === undefined ? null : decodeURIComponent(rawSlug);
}
