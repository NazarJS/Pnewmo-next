# Пункт 2: API-слой фильтрации — детальная спека для реализации

Это развёрнутая версия раздела «2. API-слой» из
[`2026-08-03-product-filter-panel-design.md`](../2026-08-03-product-filter-panel-design.md).
Здесь — конкретные файлы, сигнатуры функций и на что обратить внимание при первой
реализации. Пункт 1 (`db.json` с полями `spec_<key>_value`) уже сделан — эта
спека на него опирается.

## Что реализуем

Три функции в `entities/product/api/products.api.ts`, которые ходят в json-server
и делают всю фильтрацию **на сервере** (не забирают весь каталог в память):

1. `getCategoryFilterSchema(categoryPath)` — какие фильтры вообще показать для категории — **готово**
2. `getFilteredProducts(categoryPath, filters)` — отфильтрованный список товаров
3. `getFilterFieldCounts(categoryPath, activeFilters, field)` — счётчики рядом с чекбоксами

Плюс внутренний (неэкспортируемый) помощник `fetchProductsInCategoryScope` — общая
для всех трёх точка, которая реально ходит в json-server и понимает, что такое
«товары категории». Все три публичные функции построены поверх него.

**Важно:** в этом пункте НЕ трогаем `app/catalog/[slug]/page.tsx` и не пишем UI.
Это только API-слой. Проверять его будем через прямые вызовы функций/curl, не через
браузер.

## Поправка к основной спеке (FSD-слои)

В основной спеке `buildFilterQueryParams` был указан в `features/product-filter/lib/`,
но использует его `entities/product/api/products.api.ts`. Это нарушает правило
Feature-Sliced Design: слой `entities` не должен зависеть от слоя `features` (`features`
стоит выше и сам зависит от `entities`, а не наоборот).

**Исправление:** всё, что нужно самому API-слою, живёт в `entities/product`:

| Было (в основной спеке) | Стало |
|---|---|
| `features/product-filter/model/types.ts` (`FilterField`, `ProductFilters`) | `entities/product/model/types.ts` |
| `features/product-filter/lib/buildFilterQueryParams.ts` | `entities/product/lib/buildFilterQueryParams.ts` |
| `features/product-filter/model/parseFiltersFromSearchParams.ts` | остаётся в `features/product-filter` — это перевод URL → домен, дело конкретного UI, а не сущности товара |

## ⚠️ Поправка №2 — реальный API json-server отличается от того, что предполагала спека

Изначальный вариант этой спеки был написан по памяти о «классическом» json-server
(0.x): `_like` как regex-фильтр, повтор одного и того же query-параметра как OR.
Установленный в проекте `json-server@1.0.0-beta.15` — это полностью переписанная
v1-версия с другим движком (проверено по исходникам пакета,
`node_modules/json-server/lib/{where-operators,parse-where,matches-where}.js`,
и живыми запросами к серверу):

- **Никакого `_like`/regex нет.** Поддерживаемые операторы — только
  `lt, lte, gt, gte, eq, ne, in, contains, startsWith, endsWith`.
- **`startsWith`/`endsWith` — camelCase**, и через классический `key_op=value`
  синтаксис (`category_path_startsWith=...`) они не распознаются: разбор ключа
  `parse-where.js` матчит суффикс оператора регуляркой `[a-z]+` (только строчные
  буквы), а `startsWith` содержит `W`. Нужен **colon-синтаксис**:
  `category_path:startsWith=1.4.6.8.`. Для `gte/lte/gt/lt/eq/ne/in/contains`
  (все буквы строчные) классический `_`-синтаксис работает нормально.
- **Повтор параметра не даёт OR.** `category_id=10&category_id=11` в этой версии
  просто перезапишет значение — выживет последнее. OR внутри одного поля даёт
  только оператор `in` со значениями через запятую: `category_id_in=10,11`.
- **OR между разными полями в одном запросе вообще не выразить** через плоскую
  query-строку этой версии (сервер умеет `where.or`, но собрать такую структуру
  из `key=value` пар клиент не может — `parse-where.js` не даёт для этого
  синтаксиса). Из-за этого «товар категории = сам узел ИЛИ его потомок» пришлось
  решать двумя раздельными запросами с merge на клиенте (см. `fetchProductsInCategoryScope`
  ниже) — раньше это должен был закрывать один regex-паттерн с якорем.

Старый `buildCategoryPathPattern.ts` (одна regex-строка) удалён. Вместо него —
`entities/product/lib/buildCategoryPath.ts` с двумя маленькими функциями и
общий приватный helper `fetchProductsInCategoryScope` в `products.api.ts`.

**Практический вывод:** когда пишете новый query-параметр для json-server —
сначала проверьте его curl'ом на реальном сервере, не полагаясь на память о
том, «как обычно работает json-server». Именно так была найдена эта проблема:
`category_path_like` не падал с ошибкой, а молча возвращал `200 OK` с пустым
массивом — типичный тихий баг, который тесты «запускается без ошибок» не ловят.

## Файлы, которые нужно создать/изменить

```
src/entities/product/
├── model/
│   └── types.ts                (дополнить: FilterFiled, ProductFilters)      — готово
├── lib/
│   ├── buildCategoryPath.ts    (categoryDescendantsParam, categorySelfParam) — готово
│   ├── buildFilterQueryParams.ts  (новый)
│   └── labels.ts                (словарь подписей LABELS)                    — готово
└── api/
    └── products.api.ts          (fetchProductsInCategoryScope — готово;
                                   getCategoryFilterSchema — готово;
                                   getFilteredProducts, getFilterFieldCounts — предстоит)
```

> Примечание: в спеке изначально фигурировали имена `FilterField`/`specLabels.ts`/
> `SPEC_LABELS` — в реальном коде прижились `FilterFiled` (опечатка, оставлена как
> есть, т.к. уже используется в нескольких местах) и `labels.ts`/`LABELS`. Ниже
> везде — актуальные имена из кода, не из черновика.

---

## Шаг 1. Типы — готово

`entities/product/model/types.ts`:

```ts
export type FilterFiled =
  | { type: "range"; key: string; label: string; unit?: string; min: number; max: number }
  | { type: "enum"; key: string; label: string; values: string[] };

export type ProductFilters = Record<string, { min: number; max: number } | string[]>;
```

`ProductFilters` — словарь `ключ характеристики → значение фильтра`: диапазон
(`{min, max}`) для `range`-полей, список выбранных строк (`string[]`) для
`enum`-полей. Почти везде на этом типе понадобится `Array.isArray(value)`,
чтобы TypeScript сузил union до нужной ветки.

`Product` также дополнен полем `specifications: Record<string, string>` —
оно реально приходит в ответе `/products`, но раньше не было объявлено в типе.

---

## Шаг 2. Словарь подписей — готово

`entities/product/lib/labels.ts`, статические данные, без бизнес-логики:

```ts
export const LABELS: Record<string, { label: string; unit?: string }> = {
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
тип поля в `getCategoryFilterSchema` определяется **не по этому словарю**, а по
факту наличия `spec_<key>_value` у товаров — словарь используется только для
подписи/юнита, и его неполнота не должна ломать сам фильтр.

---

## Шаг 3. Выборка товаров категории — готово

### `entities/product/lib/buildCategoryPath.ts`

```ts
export function categoryDescendantsParam(categoryPath: string): [string, string] {
  return ["category_path:startsWith", `${categoryPath}.`];
}

export function categorySelfParam(categoryPath: string): [string, string] {
  return ["category_path", categoryPath];
}
```

Никакого regex и экранирования точек больше не нужно — `startsWith` в реальном
API сравнивает строку буквально, не как паттерн. Триггер прежней ошибки (что
`^1.4` совпал бы с `1.40` без якоря) заменился на нужду в **двух раздельных
условиях** — см. ниже, почему одной строки недостаточно.

### `fetchProductsInCategoryScope` — в `products.api.ts` (не экспортируется)

```ts
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

  const merged = new Map<string, Product>();
  for (const product of [...descendants, ...self]) {
    merged.set(product.id, product);
  }
  return [...merged.values()];
}
```

**На что обратить внимание — это самая частая ловушка в этом пункте:**

- «Товары категории» — это **не только** потомки узла, но и товары, подвешенные
  **прямо на сам узел**, если у него есть дети. Проверено на реальных данных:
  `hyd_cyl_01` (category_id=37) висит прямо на категории `1.5.37`, у которой при
  этом есть дочерние категории `1.5.37.39`/`1.5.37.40` с собственными товарами.
  Если сделать только `startsWith` — `hyd_cyl_01` молча пропадёт из выдачи
  категории 37, никакой ошибки не будет.
- `extraParams` (пока пустой `URLSearchParams()`, начиная с шага 5 — фильтры)
  применяется **к обоим** запросам одинаково — иначе после наложения фильтров
  из одной из двух веток (self/descendants) выборка перестанет быть согласованной
  с другой.
- `params.set(key, value)`, а не `append` — категорийный параметр (`category_path`
  либо `category_path:startsWith`) должен быть ровно один на запрос; если
  `extraParams` уже содержит такой ключ — переопределяем, а не дублируем.
- Дедупликация по `id` через `Map` технически избыточна (товар не может совпасть
  сразу и по `eq`, и по `startsWith`), но это самый дешёвый и надёжный способ
  слить два массива в один, ошибиться в нём сложно.

**Как проверить руками:**

```
curl "http://localhost:3001/products?category_path:startsWith=1.5.37."
curl "http://localhost:3001/products?category_path=1.5.37"
```

Первый должен вернуть 4 товара (`hc_std_01/02`, `hd_hd_01/02`), второй — один
(`hyd_cyl_01`). Оба вместе — это и есть корректная выборка категории 37.

---

## Шаг 4. `getCategoryFilterSchema` — готово

```ts
export async function getCategoryFilterSchema(categoryPath: string): Promise<FilterFiled[] | null> {
  const products = await fetchProductsInCategoryScope(categoryPath);

  if (products === null) {
    return null;
  }

  const ranges = new Map<string, { min: number; max: number }>();
  const enums = new Map<string, Set<string>>();
  const order: string[] = [];

  const rememberOrder = (key: string) => {
    if (!order.includes(key)) {
      order.push(key);
    }
  };

  // проход 1: диапазонные ключи — по факту наличия spec_<key>_value
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
  // Отдельный проход после того, как ranges уже полностью собран —
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
```

(`SPEC_VALUE_KEY_RE = /^spec_(.+)_value$/` объявлена рядом, в начале файла.)

**Проверено на реальном сервере:**

- категория с товарами (`"2"` — Пневматика) → смешанная схема из `range` и
  `enum` полей;
- несуществующая/пустая категория (`"1.14.87"`) → `[]`, без исключения;
- категория 37 (self + потомки) → границы диапазонов действительно учитывают
  все 5 товаров, включая `hyd_cyl_01`.

---

## Шаг 5. `buildFilterQueryParams` — предстоит

`entities/product/lib/buildFilterQueryParams.ts`. Чистая функция, без похода в
сеть — собирает **только** условия по характеристикам, категория сюда не
входит (её накладывает `fetchProductsInCategoryScope`):

```ts
export function buildFilterQueryParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      // OR внутри группы — оператор `in`, значения через запятую.
      // НЕ через повтор параметра (append) — в этой версии json-server
      // повтор ключа не даёт OR, выживает последнее значение.
      params.set(`specifications.${key}_in`, value.join(","));
    } else {
      params.set(`spec_${key}_value_gte`, String(value.min));
      params.set(`spec_${key}_value_lte`, String(value.max));
    }
  }

  return params;
}
```

**На что обратить внимание:**

- Значения в `value.join(",")` не должны сами содержать запятую — характеристики
  здесь технические строки из `db.json` (`"сталь"`, `"G1/2"` и т.п.), запятых в
  них не бывает, но если появится значение с запятой — `in`-разбор на сервере
  (`value.split(',')` в `parse-where.js`) его сломает. Для нынешних данных это
  не проблема, просто держите в уме источник ограничения.
- Пустой `filters` (`{}`) должен дать пустой `URLSearchParams` — то есть
  `fetchProductsInCategoryScope` с таким результатом эквивалентен «без фильтров
  вообще». Проверьте отдельным вызовом.
- Пустой массив `string[]` для `enum`-поля (все чекбоксы сняты) — это не то же
  самое, что «фильтр не задан»: технически такое поле нужно пропустить (см.
  `if (value.length === 0) continue`), а не отправлять `..._in=` с пустой строкой
  справа — иначе `value.split(',')` даст `[""]`, и сервер будет искать буквально
  пустую строку как значение характеристики.

**Проверка через curl** (после того как функция готова — руками, минуя код):

```
curl "http://localhost:3001/products?category_path:startsWith=1.4.&specifications.material_in=сталь,алюминий"
```

Должны вернуться товары из ветки `1.4.*` с `material` равным **либо** «сталь»,
**либо** «алюминий» — то есть OR действительно работает через `_in`, а не
через повтор ключа.

---

## Шаг 6. `getFilteredProducts` — предстоит

```ts
export async function getFilteredProducts(
  categoryPath: string,
  filters: ProductFilters,
): Promise<Product[] | null> {
  const params = buildFilterQueryParams(filters);
  return fetchProductsInCategoryScope(categoryPath, params);
}
```

Вся сложность уже разложена по `buildFilterQueryParams` (что фильтровать) и
`fetchProductsInCategoryScope` (как выбрать категорию) — сама функция здесь
почти не содержит логики, это осознанно.

---

## Шаг 7. `getFilterFieldCounts` — предстоит

```ts
export async function getFilterFieldCounts(
  categoryPath: string,
  activeFilters: ProductFilters,
  field: FilterFiled,
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
  Убираем фильтр **именно по полю, для которого считаем счётчики**, оставляя все
  остальные активные фильтры. Без этого после выбора `"сталь"` в `material` все
  остальные значения (`"алюминий"`, `"силикон"`) покажут `(0)` — чекбоксы станут
  «мёртвыми». Это правило описано в §2c основной спеки.
- `product.specifications?.[field.key]`, а не `spec_<key>_value` — счётчики
  считаются только для `enum`-полей, у которых числового дубля нет (см. пункт 1).
- Функция делает **отдельный сетевой запрос** внутри себя (через
  `getFilteredProducts`, а значит — через `fetchProductsInCategoryScope`, то
  есть фактически 2 запроса per вызов: self + descendants). По одному вызову
  на каждое `enum`-поле схемы (обычно 2–4 на категорию) — json-server не умеет
  `GROUP BY`, агрегировать можно только тем, что реально есть.

---

## Как проверить, что всё работает (без UI, без страницы каталога)

Поднимите json-server (`npx json-server db.json`, порт из `BASE_URL` — `3001`,
либо временно смените `BASE_URL` на другой порт, если основной сервер уже занят
дев-сессией) и проверяйте функции точечно.

1. **Категория (self + potомки)** — см. curl-примеры в шаге 3.
2. **Диапазон** — `&spec_pressure_value_gte=300&spec_pressure_value_lte=400`,
   сверьте вручную по `db.json`.
3. **OR по enum через `_in`** — curl-пример в шаге 5. Не проверяйте это по
   аналогии с чем-то виденным раньше в проекте — именно эта комбинация
   (dot-notation + `_in`) нигде больше не использовалась, и то, как она разбирается
   (`parse-where.js` → `setProperty` из `dot-prop`), стоит увидеть вживую хотя
   бы один раз.
4. **Функции целиком** — postоянных тестов в проекте нет (`package.json`
   подтверждает: ни одного test-раннера). Быстрый способ прогнать реальную
   функцию без запуска Next.js — временный `.mts`-файл с относительным (не
   `@/`) импортом и `npx tsx`:
   ```ts
   import { getFilteredProducts } from "./src/entities/product/api/products.api.ts";
   console.log(await getFilteredProducts("1.4.6.8", { pressure: { min: 300, max: 400 } }));
   ```
   Удалите файл после проверки — это одноразовый скрипт, не часть пункта.

---

## Границы пункта — что сюда НЕ входит

- `app/catalog/[slug]/page.tsx` не трогаем — это пункт 3.
- `features/product-filter/*` (кроме уже перенесённых в `entities/product` типов)
  не создаём — это тоже пункт 3.
- UI, слайдеры, чекбоксы — не в этом пункте.
- Если что-то из вышеперечисленного понадобится, чтобы проверить API руками —
  это нормально сделать как одноразовый скрипт для себя, но не коммитить как часть
  этого пункта.
