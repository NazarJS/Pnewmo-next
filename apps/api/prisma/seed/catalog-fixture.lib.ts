/**
 * Чистые преобразования выгрузки. Вынесены из скрипта ради тестов: решения о
 * качестве данных (что мусор, какой товар считать дублем) — предмет проверки,
 * а чтение файла и запись результата — нет.
 */

/** Метаданные CMS, попавшие в характеристики по недосмотру источника. */
export const JUNK_SPEC_KEYS = new Set([
  'Рейтинг',
  'Сумма оценок',
  'Количество проголосовавших',
  'Название для 2GIS',
  'Текст Alt Картинке',
]);

export interface SourceProduct {
  // 'product' у настоящего товара. Выгрузка смазки кладёт в тот же массив
  // ещё и описания категорий (type: 'category_info') без id/url/price —
  // поле нужно, чтобы flattenAll могла отличить одно от другого до того,
  // как обратится к остальным полям.
  type?: string;
  id: string;
  fullTitle: string;
  image: string;
  price: string;
  characteristics: { short?: Record<string, string>; full?: Record<string, string> };
}

export interface SourceCategory {
  name: string;
  url: string;
  products?: SourceProduct[];
  subcategories?: SourceCategory[];
}

export interface FixtureCategory {
  path: string;
  slug: string;
  name: string;
}

export interface FixtureProduct {
  externalId: string;
  categoryPath: string;
  name: string;
  imageUrl: string;
  price: number | null;
  specifications: Record<string, string>;
}

/** Слаг — последний сегмент url категории. Все 222 уникальны, проверено. */
export function slugFromUrl(url: string): string {
  const parts = url.split('/').filter(Boolean);

  return parts[parts.length - 1] ?? '';
}

/**
 * Цена в источнике — строка вида «21 493.96 ₽» с неразрывными пробелами.
 * Возвращает null, а не 0, когда разобрать не удалось: ноль означает
 * «бесплатно», а не «неизвестно».
 */
export function parsePrice(raw: string): number | null {
  // Изредка источник склеивает две цены в одну строку без разделителя —
  // «1 029 314 ₽\n                    720 519.80 ₽», похоже на «было/стало»
  // без разметки (найдено в гидравлике, 23 из 2139). Различить, где
  // кончается первое число и начинается второе, нельзя: наивная склейка
  // цифр даёт абсурдное значение, которое к тому же не помещается в
  // NUMERIC(12,2) и роняет вставку в базу. Больше одного «₽» в строке —
  // надёжный признак такой склейки на всех трёх выгрузках.
  if ((raw.match(/₽/g) ?? []).length > 1) {
    return null;
  }

  const digits = raw.replace(/[^\d.,]/g, '').replace(',', '.');

  if (digits === '') {
    return null;
  }

  const value = Number(digits);

  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

/**
 * String(value), а не прямой перенос: тип обещает Record<string, string>, но
 * источник — произвольный JSON, и следующая выгрузка может прислать число
 * вместо строки для того же ключа. Без приведения оно доедет до базы как
 * number, а `validateResponses: true` на ответе списка превратит это в 500 на
 * всю страницу, а не в ошибку на одном товаре.
 */
export function cleanSpecifications(
  short: Record<string, string> | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(short ?? {})) {
    if (!JUNK_SPEC_KEYS.has(key)) {
      result[key] = String(value);
    }
  }

  return result;
}

export interface FlattenResult {
  categories: FixtureCategory[];
  products: FixtureProduct[];
  /** Элементы products с type, отличным от 'product' — счётчик для скрипта. */
  droppedNonProducts: number;
  /** Схлопнутые дубли externalId — счётчик для скрипта. */
  duplicatesCollapsed: number;
}

/**
 * Обход одного или нескольких деревьев в глубину, в один плоский набор.
 * Путь позиционный — он лишь задаёт структуру и порядок вставки, настоящие
 * пути из идентификаторов базы считает сид. Счётчик путей общий на все
 * переданные корни и не начинается заново на каждом: иначе категории из
 * разных выгрузок получали бы одинаковые позиционные пути и конфликтовали
 * бы при связывании родитель-потомок в сиде.
 *
 * Элементы products с type, отличным от 'product', отбрасываются: выгрузка
 * смазки кладёт в тот же массив описания категорий без id/url/price, и без
 * фильтра они уехали бы в фикстуру как товары с пустыми обязательными
 * полями.
 *
 * Дубли externalId схлопываются глобально по всем переданным корням, а не
 * только внутри одного: побеждает первое вхождение, порядок корней —
 * порядок аргументов вызывающего. В пневматике таких дублей 20 из 4862 —
 * один товар лежит в двух категориях; между выгрузками добавляются ещё.
 * Честной моделью была бы связь многие-ко-многим, но она добавляет таблицу
 * и усложняет подсчёт total ради долей процента записей.
 */
export function flattenAll(roots: SourceCategory[]): FlattenResult {
  const categories: FixtureCategory[] = [];
  const products: FixtureProduct[] = [];
  const seen = new Set<string>();
  let droppedNonProducts = 0;
  let duplicatesCollapsed = 0;

  const walk = (node: SourceCategory, parentPath: string): void => {
    const path =
      parentPath === '' ? String(categories.length + 1) : `${parentPath}.${categories.length + 1}`;

    categories.push({ path, slug: slugFromUrl(node.url), name: node.name });

    for (const product of node.products ?? []) {
      if (product.type !== 'product') {
        droppedNonProducts += 1;
        continue;
      }

      if (seen.has(product.id)) {
        duplicatesCollapsed += 1;
        continue;
      }

      seen.add(product.id);

      products.push({
        externalId: product.id,
        categoryPath: path,
        // fullTitle, а не title: title всегда битая склейка короткого названия
        // с fullTitle без разделителя, «…ISO 155521391.63.0125.01 - Цилиндр…».
        // Границу склейки восстановить нельзя, а fullTitle содержит всё.
        name: product.fullTitle,
        imageUrl: product.image,
        price: parsePrice(product.price),
        specifications: cleanSpecifications(product.characteristics?.short),
      });
    }

    for (const child of node.subcategories ?? []) {
      walk(child, path);
    }
  };

  for (const root of roots) {
    walk(root, '');
  }

  return { categories, products, droppedNonProducts, duplicatesCollapsed };
}

/**
 * Одна выгрузка — частный случай flattenAll с единственным корнем. Оставлена
 * отдельной функцией ради вызывающего кода и тестов, которые говорят об
 * одном дереве: так вызов `catalog:fixture` с одним путём не меняет форму
 * вызова, только поведение под капотом.
 */
export function flatten(root: SourceCategory): FlattenResult {
  return flattenAll([root]);
}
