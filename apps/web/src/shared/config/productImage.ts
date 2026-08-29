/**
 * Единственный источник правды о том, откуда разрешено брать изображения
 * товаров. Используется в двух местах: `next.config.ts` строит из этого
 * `images.remotePatterns` (иначе next/image откажется отдавать чужой хост —
 * и в деве, и в проде), а форма товара в админке — валидирует поле imageUrl
 * при вводе.
 *
 * Хост захардкожен ровно один раз здесь. Если завести его в двух местах, они
 * рано или поздно разойдутся: кто-то поправит remotePatterns, забыв про
 * форму (или наоборот) — и тогда форма или пропустит запрещённый хост, или
 * начнёт отвергать разрешённый. Данные сейчас чистые, но именно форма,
 * способная завести плохой товар, — риск: next/image бросает исключение на
 * рендере при непройденной проверке хоста, а сетка карточек рендерится и на
 * сервере, так что один такой товар уронит всю страницу категории.
 */
export const PRODUCT_IMAGE_REMOTE_PATTERN = {
  protocol: 'https',
  hostname: 'pneumax.ru',
  pathname: '/upload/**',
} as const;

/** Человекочитаемый префикс для сообщения об ошибке в форме. */
export const PRODUCT_IMAGE_URL_PREFIX = `${PRODUCT_IMAGE_REMOTE_PATTERN.protocol}://${PRODUCT_IMAGE_REMOTE_PATTERN.hostname}/upload/`;

/**
 * Проверяет URL по тем же трём признакам, что и `images.remotePatterns`:
 * протокол, хост, префикс пути. Частичное совпадение (верный хост, но http
 * вместо https, или путь вне /upload/) должно быть отклонено формой точно
 * так же, как next/image отклонит его на рендере карточки.
 */
export function isAllowedProductImageUrl(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    url.protocol === `${PRODUCT_IMAGE_REMOTE_PATTERN.protocol}:` &&
    url.hostname === PRODUCT_IMAGE_REMOTE_PATTERN.hostname &&
    url.pathname.startsWith('/upload/')
  );
}
