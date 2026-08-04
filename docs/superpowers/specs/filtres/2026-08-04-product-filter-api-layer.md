# Пункт 2: API-слой фильтрации — детальная спека для реализации

Это развёрнутая версия раздела «2. API-слой» из
[`2026-08-03-product-filter-panel-design.md`](../2026-08-03-product-filter-panel-design.md).
Здесь — конкретные файлы, сигнатуры функций и на что обратить внимание при первой
реализации. Пункт 1 (`db.json` с полями `spec_<key>_value`) уже сделан — эта
спека на него опирается.

## Что реализуем

Три функции в `entities/product/api/products.api.ts`, которые ходят в json-server
и делают всю фильтрацию **на сервере** (не забирают весь каталог в память):

1. `getCategoryFilterSchema(categoryPath)` — какие фильтры вообще показать для категории
2. `getFilteredProducts(categoryPath, filters)` — отфильтрованный список товаров
3. `getFilterFieldCounts(categoryPath, activeFilters, field)` — счётчики рядом с чекбоксами

Плюс два небольших чистых модуля-помощника и файл с типами.

**Важно:** в этом пункте НЕ трогаем `app/catalog/[slug]/page.tsx` и не пишем UI.
Это только API-слой. Проверять его будем через прямые вызовы функций/curl, не через
браузер.

## Поправка к основной спеке (важно прочитать перед стартом)

В основной спеке `buildFilterQueryParams` был указан в `features/product-filter/lib/`,
но использует его `entities/product/api/products.api.ts`. Это нарушает правило
Feature-Sliced Design: слой `entities` не должен зависеть от слоя `features` (`features`
стоит выше и сам зависит от `entities`, а не наоборот).

**Исправление:** всё, что нужно самому API-слою, переезжает в `entities/product`:

| Было (в основной спеке) | Стало |
|---|---|
| `features/product-filter/model/types.ts` (`FilterField`, `ProductFilters`) | `entities/product/model/types.ts` |
| `features/product-filter/lib/buildFilterQueryParams.ts` | `entities/product/lib/buildFilterQueryParams.ts` |
| `features/product-filter/model/parseFiltersFromSearchParams.ts` | остаётся в `features/product-filter` — это перевод URL → домен, дело конкретного UI, а не сущности товара |

Логика: `entities/product` описывает *что такое товар и как его фильтровать* —
это домен. `features/product-filter` в пункте 3 будет использовать эти типы и
функции, плюс добавит свою — как именно фильтры представлены в URL этой конкретной
страницы. Раздел 3 основной спеки будет поправлен отдельно, когда дойдём до фичи.

## Файлы, которые нужно создать/изменить

```
src/entities/product/
├── model/
│   └── types.ts                    (дополнить: FilterField, ProductFilters)
├── lib/
│   ├── buildCategoryPathPattern.ts  (новый)
│   ├── buildFilterQueryParams.ts    (новый)
│   └── specLabels.ts                (новый — словарь подписей)
└── api/
    └── products.api.ts              (дополнить тремя функциями)
```

---

## Шаг 1. Типы

В `entities/product/model/types.ts` добавить:

```ts
export type FilterField =
  | { type: "range"; key: string; label: string; unit?: string; min: number; max: number }
  | { type: "enum"; key: string; label: string; values: string[] };

export type ProductFilters = Record<
  string,
  { min: number; max: number } | string[]
>;
```

`ProductFilters` — это словарь `ключ характеристики → значение фильтра`. Значение
либо диапазон (`{min, max}` для `type: "range"` полей), либо список выбранных строк
(`string[]` для `type: "enum"` полей). При работе с этим типом почти везде понадобится
`Array.isArray(value)`, чтобы понять, с каким из двух вариантов вы имеете дело —
TypeScript сам сузит тип после такой проверки.

**На что обратить внимание:** не пытайтесь сделать `ProductFilters` строго типизированным
по конкретным ключам (`{ pressure?: ...; weight?: ... }`) — набор характеристик разный
для каждой категории, а какая именно категория открыта, вы не знаете на этапе компиляции.
Обычный `Record<string, ...>` здесь осознанный выбор, не недосмотр.

---

## Шаг 2. Словарь подписей — `entities/product/lib/specLabels.ts`

Человекочитаемые названия и единицы измерения для каждого технического ключа.
Это статические данные, не бизнес-логика — можно взять целиком:

```ts
export const SPEC_LABELS: Record<string, { label: string; unit?: string }> = {
  bore: { label: "Диаметр поршня", unit: "мм" },
  diameter: { label: "Диаметр", unit: "мм" },
  flow: { label: "Расход", unit: "л/мин" },
  force: { label: "Усилие", unit: "Н" },
  power: { label: "Мощность", unit: "кВт" },
  pressure: { label: "Давление", unit: "бар" },
  rod: { label: "Диаметр штока", unit: "мм" },
  stroke: { label: "Ход штока", unit: "мм" },
  temperature: { label: "Температура", unit: "°C" },
  weight: { label: "Вес", unit: "кг" },
  control: { label: "Управление" },
  manual: { label: "Ручной дублёр" },
  material: { label: "Материал" },
  oil: { label: "Смазка" },
  port: { label: "Присоединение" },
  ports: { label: "Тип распределителя" },
  thread: { label: "Резьба" },
  voltage: { label: "Напряжение" },
};
```

Ключи без `unit` — категориальные (`enum`), с `unit` — диапазонные (`range`). Но
**не полагайтесь на этот словарь при определении типа поля** в `getCategoryFilterSchema`
(шаг 4) — определяйте `range`/`enum` по факту наличия `spec_<key>_value` у товаров,
а словарь используйте только для подписи. Если в словаре забудете ключ — работоспособность
фильтра не должна от этого зависеть, страдает только подпись (см. раздел «На что
обратить внимание»).

---

## Шаг 3. `buildCategoryPathPattern` — `entities/product/lib/buildCategoryPathPattern.ts`

```ts
export function buildCategoryPathPattern(categoryPath: string): string {
  const escaped = categoryPath.replace(/\./g, "\\.");
  return `^${escaped}(\\.|$)`;
}
```

**На что обратить внимание — это самая частая ошибка в этом пункте:**

- Без экранирования точки (`.` — спецсимвол regex, означает «любой символ») паттерн
  `^1.4` формально совпадёт и с `1x4`, хоть в реальных путях такого не будет — экранируйте
  всё равно, это дешёво и правильно.
- Без якоря `(\.|$)` в конце паттерн `^1.4` совпадёт с `1.40`, `1.45`, `1.4567` —
  то есть с совершенно другими ветками дерева, у которых просто путь начинается с тех
  же цифр. Проверьте на реальных данных: в категориях `1.4` и `1.40` (если такая
  появится) наличие якоря — единственное, что их разделяет.
- Проверяйте на входных данных из `db.json`: `path` категории всегда просто `id`-шки
  через точку (`"1.4.6.8.10"`), без пробелов и прочих спецсимволов — экранировать
  кроме точки больше нечего.

Быстрый ручной тест (можно прямо в `node`):

```js
const re = /^1\.4(\.|$)/;
re.test("1.4")       // true — сама категория
re.test("1.4.6")     // true — потомок
re.test("1.40")      // false — не потомок, просто похожий id
re.test("1.14")      // false — другая ветка
```

---

## Шаг 4. `getCategoryFilterSchema` — в `products.api.ts`

```ts
export async function getCategoryFilterSchema(
  categoryPath: string
): Promise<FilterField[] | null> {
  const pattern = buildCategoryPathPattern(categoryPath);
  const response = await fetch(
    `${BASE_URL}/products?category_path_like=${encodeURIComponent(pattern)}`
  );

  if (!response.ok) {
    return null;
  }

  const products: Product[] = await response.json();
  // дальше — сканирование products и построение FilterField[]
}
```

**Алгоритм сканирования** (заполните сами, это ядро пункта):

1. Пройтись по всем товарам, собрать множество ключей вида `spec_<key>_value`,
   которые реально встречаются хотя бы у одного товара — это ваши `range`-поля.
   Извлекайте `<key>` регуляркой вроде `/^spec_(.+)_value$/`, не перечисляйте ключи
   руками — иначе схема разъедется с данными при следующем добавлении характеристики
   в `db.json`.
2. Для каждого такого `<key>` пройтись по товарам ещё раз (или за один проход,
   аккумулируя) и найти `min`/`max` среди значений `spec_<key>_value` — **пропускайте
   товары, где поля нет** (`undefined`), не считайте это как `0`.
3. Пройтись по `specifications` каждого товара, собрать ключи, у которых **нет**
   соответствующего `spec_<key>_value` ни у одного товара категории — это `enum`-поля.
   Для каждого — собрать `Set` уникальных строковых значений `specifications[key]`.
4. Для подписи и юнита — `SPEC_LABELS[key]`. Если ключа в словаре нет — не роняйте
   функцию, подставьте сам технический ключ как label (`SPEC_LABELS[key]?.label ?? key`).

**На что обратить внимание:**

- Если у товара характеристика вообще отсутствует (нет ни в `specifications`, ни
  в `spec_*_value`) — это нормально, просто пропускаете её для этого товара. Не
  все товары категории обязаны иметь одинаковый набор характеристик (сверьтесь
  с `db.json` — у насосов есть `thread` не у всех, например).
- Пустая категория (0 товаров) → верните `[]`, а не `null` и не бросайте исключение.
  `null` в этом файле зарезервирован именно под сетевую ошибку/`!response.ok`,
  различие важно для того, кто вызывает функцию дальше.
- Возвращаемый порядок полей в массиве — на ваше усмотрение, но имеет смысл
  зафиксировать какой-то (например, по порядку первого появления ключа в товарах)
  — иначе панель фильтров будет визуально «прыгать» между перерендерами.

---

## Шаг 5. `buildFilterQueryParams` — `entities/product/lib/buildFilterQueryParams.ts`

Чистая функция, без похода в сеть — только сборка `URLSearchParams`:

```ts
export function buildFilterQueryParams(
  categoryPath: string,
  filters: ProductFilters
): URLSearchParams {
  const params = new URLSearchParams();
  params.append("category_path_like", buildCategoryPathPattern(categoryPath));

  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      // enum: OR внутри группы — повтор одного и того же ключа
      value.forEach((v) => params.append(`specifications.${key}`, v));
    } else {
      params.append(`spec_${key}_value_gte`, String(value.min));
      params.append(`spec_${key}_value_lte`, String(value.max));
    }
  }

  return params;
}
```

**На что обратить внимание:**

- `URLSearchParams.append` (не `set`!) — принципиально для OR-семантики enum-фильтра:
  несколько значений одного ключа (`specifications.material=сталь&specifications.material=алюминий`)
  должны попасть в query как повторяющийся параметр, а не перезаписать друг друга.
- Это ровно та же логика повтора параметра, что уже используется в проекте для
  `category_id=X&category_id=Y` — но теперь на dot-notation ключе. **Обязательно
  проверьте вручную через curl**, что json-server действительно трактует повтор
  `specifications.material=...` как OR (а не игнорирует все вхождения кроме
  последнего) — это комбинация (dot-notation + repeat), которую в проекте раньше
  не использовали, полагаться на аналогию с `category_id` недостаточно.
- Пустой `filters` (`{}`) должен дать `URLSearchParams`, где есть только
  `category_path_like` — то есть эквивалентно «без фильтров вообще». Проверьте это
  отдельным тестовым вызовом.

---

## Шаг 6. `getFilteredProducts` — в `products.api.ts`

```ts
export async function getFilteredProducts(
  categoryPath: string,
  filters: ProductFilters
): Promise<Product[] | null> {
  const params = buildFilterQueryParams(categoryPath, filters);
  const response = await fetch(`${BASE_URL}/products?${params.toString()}`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}
```

Здесь логики почти нет — вся сложность уже в `buildFilterQueryParams`. Главное —
не забыть `${params.toString()}`, а не подставлять объект `URLSearchParams` в
строку напрямую (он сам по себе не строка).

---

## Шаг 7. `getFilterFieldCounts` — в `products.api.ts`

```ts
export async function getFilterFieldCounts(
  categoryPath: string,
  activeFilters: ProductFilters,
  field: FilterField
): Promise<Record<string, number> | null> {
  if (field.type !== "enum") {
    return null; // счётчики нужны только чекбоксам
  }

  const { [field.key]: _own, ...filtersWithoutOwnGroup } = activeFilters;

  const products = await getFilteredProducts(categoryPath, filtersWithoutOwnGroup);
  if (products === null) {
    return null;
  }

  const counts: Record<string, number> = {};
  for (const value of field.values) {
    counts[value] = 0;
  }
  for (const product of products) {
    const value = product.specifications?.[field.key];
    if (value !== undefined && value in counts) {
      counts[value] += 1;
    }
  }
  return counts;
}
```

**На что обратить внимание — это концептуально самая тонкая часть пункта:**

- Ключевая строка — `const { [field.key]: _own, ...filtersWithoutOwnGroup } = activeFilters`.
  Здесь мы убираем фильтр **именно по полю, для которого считаем счётчики**, но
  оставляем все остальные активные фильтры. Если этого не сделать (использовать
  весь `activeFilters` как есть), то после выбора значения `"сталь"` в фильтре
  `material` все остальные значения (`"алюминий"`, `"силикон"`) начнут показывать
  `(0)`, потому что выборка уже отфильтрована по `material=сталь` — чекбоксы станут
  «мёртвыми». Именно это правило описано в §2c основной спеки.
- Обратите внимание, что здесь используется `product.specifications`, а не
  `spec_<key>_value` — счётчики считаются только для `enum`-полей, у них исходное
  значение всегда живёт в `specifications`, числового дубля нет (см. пункт 1: мы
  сознательно не создавали `spec_<key>_value` для категориальных ключей).
- Эта функция делает **отдельный сетевой запрос** внутри себя (через
  `getFilteredProducts`). Это осознанное решение из основной спеки: по одному
  запросу на каждое `enum`-поле схемы (обычно 2–4 на категорию), не один
  супер-запрос на всё сразу — json-server не умеет `GROUP BY`, агрегировать
  можно только тем, что есть.
- `product.specifications?.[field.key]` — опциональная цепочка на случай, если у
  конкретного товара характеристики вообще нет (не факт, что все товары в
  подвыборке её имеют).

---

## Как проверить, что всё работает (без UI, без страницы каталога)

Поднимите json-server (`npx json-server db.json`, порт по умолчанию из
`BASE_URL` — `3001`) и проверяйте функции точечно.

1. **Паттерн пути** — curl напрямую:
   ```
   curl "http://localhost:3001/products?category_path_like=%5E1%5C.4%28%5C.%7C%24%29"
   ```
   (это urlencoded `^1\.4(\.|$)`) — должны вернуться все товары ветки «Гидравлика →
   Смазочная техника», и ничего лишнего.

2. **Диапазон** — добавьте `&spec_pressure_value_gte=300&spec_pressure_value_lte=400`
   к любому рабочему запросу категории, сверьте вручную по `db.json`, что вернулись
   именно те товары, у которых `spec_pressure_value` в этих границах.

3. **OR по enum** — `&specifications.material=сталь&specifications.material=алюминий`,
   проверьте, что вернулись товары с обоими значениями, а не только с одним
   (это тот самый пункт, который нельзя просто предположить по аналогии).

4. **Функции целиком** — временно вызовите их из любого серверного скрипта
   (например, добавьте `console.log` вызов в `page.tsx` под `if (process.env.NODE_ENV
   === "development")` и уберите после проверки, либо напишите одноразовый
   `scripts/check-filters.ts` и прогоните через `npx tsx`) — постоянных тестов
   в проекте нет (`package.json` подтверждает: ни одного test-раннера), так что
   ручная проверка через реальный fetch — единственный способ убедиться, что
   всё работает.

---

## Границы пункта — что сюда НЕ входит

- `app/catalog/[slug]/page.tsx` не трогаем — это пункт 3.
- `features/product-filter/*` (кроме уже перенесённых в `entities/product` типов)
  не создаём — это тоже пункт 3.
- UI, слайдеры, чекбоксы — не в этом пункте.
- Если что-то из вышеперечисленного понадобится, чтобы проверить API руками —
  это нормально сделать как одноразовый скрипт для себя, но не коммитить как часть
  этого пункта.
