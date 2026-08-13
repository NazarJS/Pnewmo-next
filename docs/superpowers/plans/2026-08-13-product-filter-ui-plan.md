# Панель фильтрации товаров — UI и интеграция со страницей каталога

> Это план для **самостоятельной реализации** (учебный), не для агентного исполнителя.
> Здесь нет чеклистов `- [ ]` под `executing-plans`/`subagent-driven-development` —
> шаги описывают, что и зачем нужно сделать, а не пошаговые команды для автоматического
> исполнения. Код внутри намеренно не приводится: цель — разобраться самому.

**Спеки, на которые план опирается:**
- `docs/superpowers/specs/2026-08-03-product-filter-panel-design.md` — общий дизайн (разделы 3–4 — то, что здесь реализуется)
- `docs/superpowers/specs/filtres/2026-08-04-product-filter-api-layer.md` — API-слой (уже реализован и протестирован)

**Исходное состояние:** `entities/product` (API-слой: `getCategoryFilterSchema`, `getFilteredProducts`, `getFilterFieldCounts`, `buildFilterQueryParams`) — готово и протестировано вживую против json-server. `features/product-filter` — не существует. `app/catalog/[slug]/page.tsx` — всё ещё на старом подходе (`getChildCategoryIds` + фильтрация в памяти по `category_id`), это часть работы ниже.

**Порядок шагов жёсткий по зависимостям:** Шаг 2 не заработает без Шага 1 (нечем читать `searchParams`), Шаг 3 бессмысленно верстать без Шага 2 (неоткуда взять реальные пропсы, разве что временно на моках).

---

## Шаг 1. `features/product-filter/model/parseFiltersFromSearchParams.ts`

**Зачем первым:** единственная функция, которая переводит URL в формат, понятный API-слою (`ProductFilters` из `entities/product/model/types.ts`). Без неё `page.tsx` не сможет позвать `getFilteredProducts`.

**Контракт:** `(searchParams) => ProductFilters`.

Важный нюанс: в Next 16 (App Router) `searchParams` на странице приходит как
`Record<string, string | string[] | undefined>` (плоский объект), а не как `URLSearchParams`.
Сигнатура должна принимать именно этот тип.

**Что нужно решить самому (спека это не фиксирует):**
- Конвенция ключей в URL, которая отличает range-фильтр от enum-фильтра. Например:
  `pressure_min=100&pressure_max=400` для диапазона, `material=сталь,алюминий` для enum
  (через запятую, `.split(',')`). Какую бы схему ни выбрал — она должна быть симметричной
  тому, что потом `ProductFilterPanel` пишет через `router.push` (Шаг 3).
- Числа из URL — всегда строки, не забыть привести (`Number(...)`).

**Обязательные edge-cases (§4 основной спеки):** битый/произвольный query не должен ронять
функцию — нераспознанные ключи и нечисловые значения диапазона молча игнорируются, без
исключений.

**Как проверить, не трогая UI:** вызвать функцию руками с разными объектами
(`{}`, `{pressure_min: 'abc'}`, `{material: 'сталь,алюминий'}`) и посмотреть в консоли,
что вернулось. Через `node --experimental-strip-types` можно прогнать файл напрямую, минуя
сборку Next — как тестировался API-слой в этой же сессии.

---

## Шаг 2. Переписать `app/catalog/[slug]/page.tsx`

**Что уходит:** импорт и вызов `getChildCategoryIds`, `getProducts()` целиком, ручная
фильтрация `products.filter(...)` по `categoryIds.includes(product.category_id)`.

**Что приходит:**

1. Компонент уже принимает `params: Promise<{ slug }>` — по аналогии добавляется
   `searchParams: Promise<Record<string, string | string[] | undefined>>`, и его тоже
   нужно `await`-ить (в проекте `params` уже так делается, `searchParams` в Next 16 —
   такой же промис).
2. После того как категория найдена по `slug` (эта часть остаётся как есть) — берём
   `category.path`.
3. `filters = parseFiltersFromSearchParams(searchParams)`.
4. Схема и список enum-полей: `getCategoryFilterSchema(category.path)`, из результата
   отфильтровать `field.type === 'enum'` — это то, для чего дальше нужны счётчики.
5. Один `Promise.all` на: `getFilteredProducts(category.path, filters)` + по одному
   `getFilterFieldCounts` на каждое enum-поле. Саму схему (шаг 4) можно тоже включить
   в этот `Promise.all` — она не зависит от результатов остальных запросов.
6. Рендер `<ProductFilterPanel schema={schema} counts={countsByField} activeFilters={filters} />`
   рядом с сеткой товаров.

**На что обратить внимание:**
- `getFilteredProducts`/`getCategoryFilterSchema` возвращают `null` при сетевом сбое —
  фолбэк на `?? []`, тем же паттерном, что уже есть для `getProducts`/`getProductId`.
- Если `getCategoryFilterSchema` вернул `[]` (в категории нет товаров) — `ProductFilterPanel`
  не рендерится вовсе.
- Сбой одного конкретного `getFilterFieldCounts` (`null`) не должен блокировать рендер
  всей панели — просто у этого поля не будет счётчика, чекбоксы остаются кликабельными.

**Проверка:** это серверный рендеринг, curl тут не поможет напрямую — открывать страницу
в браузере с разными `?pressure_min=...` в адресной строке и смотреть, меняется ли список
товаров.

---

## Шаг 3. `features/product-filter/ui/ProductFilterPanel.tsx` (+ `.module.scss`)

Конвенции проекта (см. скилл `component-structure`):
- `"use client"` первой строкой — компоненту нужны хуки и роутер
- `interface ProductFilterPanelProps` прямо над компонентом, в том же файле
- `const ProductFilterPanel = (...) => {...}; export default ProductFilterPanel;`
  (не `export default function`, не инлайновый `export default (props) => {}`)
- Стили — `ProductFilterPanel.module.scss`, колокейтед рядом же

**Логика внутри:**
- По каждому полю схемы: `type: "range"` → слайдер/два числовых инпута с границами
  `min`/`max` из схемы; `type: "enum"` → чекбоксы по `values`, рядом счётчик из
  `counts[field.key]`.
- Значения с `count === 0` — **дизейблятся, не скрываются** (§2c основной спеки) —
  пропадающие опции ломают ориентацию пользователя в панели.
- Изменение фильтра → собрать новый query-объект (симметричный формату из Шага 1!) →
  `router.push` с обновлённым query. Для слайдера — дебаунс ~300мс, чтобы не слать запрос
  на каждый пиксель перетаскивания.
- Сброс фильтров при переходе в другую категорию — специального кода не нужно: новый
  `slug` — это новый роут с чистыми `searchParams` сам по себе.

**Проверка:** дев-сервер + браузер, руками подвигать чекбоксы/слайдер, смотреть на URL
и на список товаров одновременно.

---

## Если что-то не сходится

Каждый шаг проверяем независимо, прежде чем переходить к следующему — так проще понять,
на каком именно слое проблема (данные из API / разбор URL / рендер компонента). Если
конкретный шаг не заработал — разбираем предметно, что именно пошло не так, а не
переписываем весь кусок заново.
