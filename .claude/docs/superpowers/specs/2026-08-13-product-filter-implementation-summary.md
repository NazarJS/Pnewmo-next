# Панель фильтрации товаров — что реализовано по спекам 03.08 и 04.08

> Итоговый отчёт о том, что уже сделано, и зачем каждая часть нужна. Не план и не
> спека — сюда возвращаться, когда нужно вспомнить «а почему это устроено именно
> так», не перечитывая всю переписку заново.

**Источники:**
- `docs/superpowers/specs/2026-08-03-product-filter-panel-design.md` — общий дизайн задачи
- `docs/superpowers/specs/2026-08-04-product-filter-api-layer.md` — детальная спека API-слоя (там же — разбор реального поведения `json-server@1.0.0-beta.15`)
- `docs/superpowers/plans/2026-08-13-product-filter-ui-plan.md` — план на оставшуюся часть (UI-панель)

## Зачем всё это вообще нужно

Страница `/catalog/[slug]` должна фильтровать товары по характеристикам
(`specifications`): давление, диаметр, материал и т.п. Товаров со временем станет
много, поэтому фильтрация не может работать по принципу «выгрузить всё и отфильтровать
в памяти» — так уже было устроено раньше через `getChildCategoryIds` + `getProducts()`,
и именно это заменено.

Дальше — по шагам, в порядке от данных к странице.

---

## 1. Данные: `db.json`

К каждому товару рядом с уже существовавшим `specifications` (строки вида
`"до 400 бар"`) добавлены **плоские числовые поля** `spec_<key>_value` — но только
для характеристик, которые имеет смысл фильтровать диапазоном:

```json
{
  "specifications": { "pressure": "до 400 бар", "flow": "до 2 л/мин" },
  "spec_pressure_value": 400,
  "spec_flow_value": 2,
  "category_path": "1.4.6.8.10"
}
```

**Почему так:** `specifications.pressure` как строка не фильтруется через
`_gte`/`_lte` на json-server — число и единица измерения слиты в одну строку.
Категориальные характеристики (`material`, `control`) отдельного числового поля не
получили — они фильтруются точным совпадением по самому `specifications.<key>`.

**Статус:** эта работа уже была сделана раньше в истории git (`git show HEAD:db.json`),
но по старому пути (`src/db.json`, до переезда в монорепо) — при переносе в
`apps/web/` файлы не скопировали, и `apps/web/db.json` оказался версией **без**
`spec_<key>_value`. Перенесено заново из истории `git show HEAD:...` — данные
идентичны 1:1, кроме этих полей (сверено программно перед копированием).

---

## 2. Типы: `entities/product/model/types.ts`

```ts
interface Product {
  id: string;
  title: string;
  description: string;
  category_id: number;
  specifications: Record<string, string>;
  [key: `spec_${string}_value`]: number | undefined;
}

type FilterFiled =
  | { type: "range"; key: string; label: string; unit?: string; min: number; max: number }
  | { type: "enum"; key: string; label: string; values: string[] };

type ProductFilters = Record<string, { min: number; max: number } | string[]>;
```

**Почему индексная сигнатура, а не перечисление конкретных полей:** набор
`spec_*_value` разный для разных категорий (у насосов — давление/расход, у
цилиндров — диаметр/ход штока) — строгая типизация по именам не подходит, нужен
только паттерн.

**`FilterFiled`** (да, с опечаткой — «Filed» вместо «Field»; оставлена намеренно, она
уже разошлась по нескольким файлам, переименование сейчас стоит дороже, чем несёт
пользы) — это то, что возвращает схема фильтров для одной характеристики: либо
диапазон с границами, либо список допустимых значений.

**`ProductFilters`** — словарь «ключ характеристики → выбранное значение фильтра»:
`{min, max}` для диапазона, `string[]` для enum (выбранные чекбоксы).

---

## 3. Словарь подписей: `entities/product/lib/labels.ts`

Статический `Record<string, {label, unit?}>` — человекочитаемые названия
характеристик (`pressure` → «Давление», `бар`). Ключи без `unit` считаются
категориальными по смыслу словаря, но **тип поля** (`range` vs `enum`) в схеме
определяется не этим словарём, а фактическим наличием `spec_<key>_value` у товаров —
неполнота словаря не может сломать сам фильтр, в худшем случае просто покажет
техническое имя ключа вместо русской подписи.

---

## 4. Выборка товаров категории: `entities/product/lib/buildCategoryPath.ts`

```ts
function categoryDescendantsParam(categoryPath: string): [string, string] {
  return ["category_path:startsWith", `${categoryPath}.`];
}

function categorySelfParam(categoryPath: string): [string, string] {
  return ["category_path", categoryPath];
}
```

**Почему два условия, а не одно:** установленный `json-server@1.0.0-beta.15` — не
классический json-server. Проверено по исходникам пакета и живыми запросами:

- Нет `_like`/regex вообще — только `lt/lte/gt/gte/eq/ne/in/contains/startsWith/endsWith`.
- `startsWith` — camelCase, через `key_op=value` не распознаётся (разбор ключа
  ловит только суффиксы из строчных букв) — нужен colon-синтаксис:
  `category_path:startsWith=1.4.6.8.`.
- «Товары категории» — это не только потомки узла (`startsWith`), но и товары,
  подвешенные **прямо на сам узел**, если у него есть дети. Реальный пример в
  данных: `hyd_cyl_01` висит на категории `1.5.37`, у которой при этом есть дочерние
  категории со своими товарами. Без отдельного `eq`-запроса этот товар молча
  пропадёт из выдачи — без единой ошибки.

Отсюда — `fetchProductsInCategoryScope` в `products.api.ts` делает **два** запроса
и сливает результат по `id` через `Map` (дедупликация технически избыточна, товар
не может совпасть по обоим условиям сразу, но это самый дешёвый и надёжный способ
слить два массива).

---

## 5. API-слой: `entities/product/api/products.api.ts`

Три публичные функции поверх общего приватного `fetchProductsInCategoryScope`:

### `getCategoryFilterSchema(categoryPath)`
Берёт **все** товары категории (без фильтров) и строит схему: диапазонные поля —
по факту наличия `spec_<key>_value` у товаров, категориальные — по ключам
`specifications`, у которых такого числового поля нет. Схема считается от полного
набора товаров, а не отфильтрованного — иначе границы слайдера «плавали» бы при
каждом изменении фильтра.

### `getFilteredProducts(categoryPath, filters)`
Строит `URLSearchParams` через `buildFilterQueryParams` и передаёт их как
`extraParams` в `fetchProductsInCategoryScope` — фильтры применяются **к обоим**
внутренним запросам (self и descendants) одинаково, иначе выборка расползлась бы.

### `getFilterFieldCounts(categoryPath, activeFilters, field)`
Счётчик рядом с каждым чекбоксом enum-поля. Ключевая строка:

```ts
const { [field.key]: _own, ...filtersWithoutOwnGroup } = activeFilters;
```

Считает счётчики по выборке со всеми активными фильтрами, **кроме фильтра по этому
же полю** — иначе после выбора одного значения материала все остальные значения
(«алюминий», «силикон») показали бы `(0)` и стали бы недоступны для выбора.
Для `range`-полей возвращает `null` — счётчики нужны только чекбоксам.

### `buildFilterQueryParams(filters)` — `entities/product/lib/buildFilterQueryParams.ts`
Диапазон → `spec_<key>_value_gte`/`_lte`. Enum (OR внутри группы) → **`_in` со
значениями через запятую**, не повтор параметра — в этой версии json-server повтор
ключа не даёт OR, выживает последнее значение.

**Проверено вживую** (Node 24, `node --experimental-strip-types`, реальный
json-server, не переписанная логика «на бумаге»):
- диапазон сужает корректно, включая комбинацию range + enum одновременно;
- OR через `_in` работает на двух разных категориях/полях (`port`, `material`);
- own-group exclusion в счётчиках подтверждена: выбор `port: ["G1/4"]` не обнуляет
  счётчики остальных значений `port`;
- счётчики на range-поле → `null`;
- пустая категория → `getCategoryFilterSchema` даёт `[]`, `getFilteredProducts` — тоже
  `[]`, не `null`.

---

## 6. Разбор URL: `features/product-filter/model/parseFiltersFromSearchParams.ts`

Переводит `searchParams` страницы (`Record<string, string | string[] | undefined>`,
именно такой тип у App Router в Next 16, не `URLSearchParams`) в `ProductFilters`.

**Конвенция ключей в URL** (не зафиксирована спекой, решена по ходу реализации):
- диапазон: `pressure_min=100&pressure_max=400`
- enum: `material=сталь,алюминий` (через запятую)

**Сигнатура — с валидацией по схеме:**

```ts
function parseFiltersFromSearchParams(
  searchParams: NextSearchParams,
  schema: FilterFiled[],
): ProductFilters
```

Второй параметр появился не сразу — изначально функция принимала любой ключ из URL
за валидный фильтр. Тесты показали дыру: `?junk_param=whatever` тихо превращался в
`specifications.junk_param_in=whatever`, что не падает, но и не «игнорируется» в
смысле спеки — json-server просто не находит товаров с таким полем и возвращает
пустой список **вместо** страницы без фильтра вообще. Схема нужна, чтобы отличить
реальный ключ категории от мусора, и чтобы не дать `_min`/`_max` на enum-поле или
запятую на range-поле — тип ключа в URL должен совпадать с типом поля в схеме.

**Неочевидные детали:**
- `Number('') === 0` в JS, не `NaN` — пустое значение параметра проверяется на
  пустую строку **до** `Number(...)`, иначе `?pressure_min=&pressure_max=400` тихо
  дало бы `{min: 0, max: 400}`.
- Неполная пара (`pressure_min` есть, `pressure_max` нет) — весь ключ отбрасывается,
  а не подставляется частично: `ProductFilters` не умеет хранить «только нижнюю
  границу».
- `searchParams[key]` может быть `string[]`, если в URL случайно повторился ключ —
  нормализуется в одну строку до `.split(',')`.

**Проверено на 6 сценариях** — валидный range, валидный enum, мусорный ключ
(отброшен), `_min`/`_max` на enum-поле (отброшено), запятая на range-поле
(отброшено), ключ не из схемы вообще (отброшен).

---

## 7. Интеграция со страницей: `app/catalog/[slug]/page.tsx`

Что ушло: `getChildCategoryIds` (рекурсивный обход `parent_id` в JS) и фильтрация
`products.filter(...)` в памяти — файл `getChildCategoryIds.ts` удалён, он стал
полностью мёртвым кодом.

Что пришло:

```
1. найти категорию по slug (как раньше) → category.path
2. schema = await getCategoryFilterSchema(category.path) ?? []
3. filters = parseFiltersFromSearchParams(searchParams, schema)
4. enumFields = schema.filter(f => f.type === 'enum')
5. Promise.all([
     getFilteredProducts(category.path, filters),
     Promise.all(enumFields.map(f => getFilterFieldCounts(category.path, filters, f))),
   ])
6. products, counts — в рендер
```

**Почему схема считается до `Promise.all`, а не внутри него:** `parseFiltersFromSearchParams`
теперь принимает схему вторым аргументом (см. §6) — без неё нечем провалидировать
URL, поэтому схема не может параллелиться с остальными запросами, она нужна раньше
их всех.

`searchParams` — теперь тоже `Promise` (симметрично `params`, требование Next 16),
и тоже `await`-ится в начале компонента.

**Проверено вживую через реальные HTTP-запросы к странице:**

| Запрос | Результат |
|---|---|
| `/catalog/pnevmatika` | 9 товаров — полная категория |
| `?pressure_min=8&pressure_max=9` | 3 товара — только `pressure=8` |
| `?port=G1/4` | 2 товара |
| `?junk_param=whatever` | те же 9, что и без фильтров — мусор действительно проигнорирован сквозь всю цепочку |
| `/catalog/standartnye_gidrotsilindry` (self+descendants) | 5 товаров, включая узловой `hyd_cyl_01` |
| `/catalog/does-not-exist` | «Категория не найдена» — фолбэк не сломан |

---

## Что осталось (не реализовано)

`features/product-filter/ui/ProductFilterPanel.tsx` — сам UI-компонент: слайдеры,
чекбоксы, счётчики, `router.push` с дебаунсом. `page.tsx` уже готов его принять —
на месте оставлен `TODO` с точной сигнатурой пропсов
(`schema`, `counts`, `activeFilters`). Подробный план — в
`docs/superpowers/plans/2026-08-13-product-filter-ui-plan.md`, шаг 3.
