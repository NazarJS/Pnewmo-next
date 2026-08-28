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
  const digits = raw.replace(/[^\d.,]/g, '').replace(',', '.');

  if (digits === '') {
    return null;
  }

  const value = Number(digits);

  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

export function cleanSpecifications(
  short: Record<string, string> | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(short ?? {})) {
    if (!JUNK_SPEC_KEYS.has(key)) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Обход дерева в глубину. Путь позиционный — он лишь задаёт структуру и
 * порядок вставки, настоящие пути из идентификаторов базы считает сид.
 *
 * Дубли externalId схлопываются: побеждает первое вхождение. В источнике их 20
 * из 4862 — один товар лежит в двух категориях. Честной моделью была бы связь
 * многие-ко-многим, но она добавляет таблицу и усложняет подсчёт total ради
 * 0.4% записей.
 */
export function flatten(root: SourceCategory): {
  categories: FixtureCategory[];
  products: FixtureProduct[];
} {
  const categories: FixtureCategory[] = [];
  const products: FixtureProduct[] = [];
  const seen = new Set<string>();

  const walk = (node: SourceCategory, parentPath: string): void => {
    const path =
      parentPath === '' ? String(categories.length + 1) : `${parentPath}.${categories.length + 1}`;

    categories.push({ path, slug: slugFromUrl(node.url), name: node.name });

    for (const product of node.products ?? []) {
      if (seen.has(product.id)) {
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

  walk(root, '');

  return { categories, products };
}
