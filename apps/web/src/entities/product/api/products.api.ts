import { Product, ProductId, FilterFiled } from "@/entities/product/model/types";
import { categoryDescendantsParam, categorySelfParam } from "@/entities/product/lib/buildCategoryPath";
import { LABELS } from "@/entities/product/lib/labels";

const BASE_URL = 'http://localhost:3001';

const SPEC_VALUE_KEY_RE = /^spec_(.+)_value$/;

// Товары категории = сам узел (eq) ИЛИ его потомки (startsWith) — два раздельных
// запроса, т.к. этот json-server не умеет OR между разными полями в одном запросе.
// Оба запроса принимают одинаковые extraParams (диапазон/enum фильтры), поэтому
// результат остаётся ограничен категорией даже с наложенными фильтрами.
async function fetchProductsInCategoryScope(
  categoryPath: string,
  extraParams: URLSearchParams = new URLSearchParams(),
): Promise<Product[] | null> {
  const buildUrl = ([key, value]: [string, string]) => {
    const params = new URLSearchParams(extraParams);
    params.set(key, value);
    return `${BASE_URL}/products?${params.toString()}`;
  };

  const [descendantsRes, selfRes] = await Promise.all([
    fetch(buildUrl(categoryDescendantsParam(categoryPath))),
    fetch(buildUrl(categorySelfParam(categoryPath))),
  ]);

  if (!descendantsRes.ok || !selfRes.ok) {
    return null;
  }

  const [descendants, self]: [Product[], Product[]] = await Promise.all([
    descendantsRes.json(),
    selfRes.json(),
  ]);

  // дедупликация по id — теоретически товар не может одновременно совпасть
  // по eq и по startsWith, но Map по id всё равно самый дешёвый и надёжный способ слить два списка
  const merged = new Map<string, Product>();
  for (const product of [...descendants, ...self]) {
    merged.set(product.id, product);
  }
  return [...merged.values()];
}

export async function getProducts(): Promise<Product[] | null> {
  const response = await fetch(`${BASE_URL}/products`);

  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function getProductId(id: string): Promise<ProductId | null> {
  const response = await fetch(`${BASE_URL}/products?id=${id}`);

  if (!response.ok) {
    return null;
  }

  const data: ProductId[] = await response.json();

  const product = data[0];

  return product ?? null;
}

export async function getCategoryFilterSchema(categoryPath: string): Promise<FilterFiled[] | null> {
  const products = await fetchProductsInCategoryScope(categoryPath);

  if (products === null) {
    return null;
  }

  // key -> границы диапазона, встреченные хотя бы у одного товара
  const ranges = new Map<string, { min: number; max: number }>();
  // key -> множество уникальных строковых значений (категориальные характеристики)
  const enums = new Map<string, Set<string>>();
  // порядок первого появления ключа — чтобы панель фильтров не «прыгала» между рендерами
  const order: string[] = [];

  const rememberOrder = (key: string) => {
    if (!order.includes(key)) {
      order.push(key);
    }
  };

  // проход 1: диапазонные ключи определяются по факту наличия spec_<key>_value
  // хотя бы у одного товара — а не по хардкоду списка ключей
  for (const product of products) {
    for (const [propName, propValue] of Object.entries(product)) {
      const match = propName.match(SPEC_VALUE_KEY_RE);

      if (!match || typeof propValue !== "number") {
        continue;
      }

      const key = match[1];
      rememberOrder(key);

      const current = ranges.get(key);
      if (!current) {
        ranges.set(key, { min: propValue, max: propValue });
      } else {
        current.min = Math.min(current.min, propValue);
        current.max = Math.max(current.max, propValue);
      }
    }
  }

  // проход 2: категориальные ключи — то, что есть в specifications,
  // но ни у одного товара нет соответствующего spec_<key>_value.
  // Идёт отдельным проходом после того, как ranges уже полностью собран,
  // иначе результат зависел бы от порядка товаров в ответе.
  for (const product of products) {
    for (const [key, value] of Object.entries(product.specifications ?? {})) {
      if (ranges.has(key)) {
        continue;
      }

      rememberOrder(key);

      const values = enums.get(key) ?? new Set<string>();
      values.add(value);
      enums.set(key, values);
    }
  }

  return order.map((key): FilterFiled => {
    const meta = LABELS[key];
    const label = meta?.label ?? key;

    const range = ranges.get(key);
    if (range) {
      return { type: "range", key, label, unit: meta?.unit, min: range.min, max: range.max };
    }

    const values = enums.get(key) ?? new Set<string>();
    return { type: "enum", key, label, values: [...values] };
  });
}
