# Схема каталога: дерево категорий + товары + фильтры

Next.js (App Router) → PostgreSQL напрямую, без отдельного бэкенда.

---

## 1. Идея в двух предложениях

Дерево категорий хранится через тип `ltree` — путь вида `1.14.87`.
Товар хранит **копию пути своей категории**, поэтому выборка товаров любой
категории на любом уровне вложенности — это один оператор `<@`.

Никаких рекурсивных CTE, никаких `parent_id IN (SELECT ...)`, никакого
изменения кода при добавлении четвёртого и пятого уровня.

---

## 2. Структура дерева

```
Гидравлика                      id=1    path = 1
└── Фитинги и РВД               id=14   path = 1.14
    ├── Фитинги                 id=87   path = 1.14.87
    ├── Трубы                   id=88   path = 1.14.88
    └── РВД                     id=89   path = 1.14.89
```

`path` строится из **id**, а не из слагов. Слаг можно переименовать
(SEO, опечатка) без переписывания путей у всего поддерева.

### Как ложатся товары

| SKU                          | category_id | category_path | виден в категориях |
|------------------------------|-------------|---------------|--------------------|
| 100107.4 Врезное кольцо      | 87          | `1.14.87`     | Гидравлика, Фитинги и РВД, Фитинги |
| Труба 10x1 оцинкованная      | 88          | `1.14.88`     | Гидравлика, Фитинги и РВД, Трубы |
| РВД 2SN DN12                 | 89          | `1.14.89`     | Гидравлика, Фитинги и РВД, РВД |
| Каталог гидравлики (общий)   | 14          | `1.14`        | Гидравлика, Фитинги и РВД |
| Что-то общее по гидравлике   | 1           | `1`           | только Гидравлика |

Последние две строки — ответ на вопрос «а если товар лежит только в верхней
категории, не проваливаясь глубже». У него просто короче путь. Он попадает
в выборку родителя, потому что `<@` включает и сам узел, и не попадает
в выборку детей.

---

## 3. DDL

```sql
CREATE EXTENSION IF NOT EXISTS ltree;

-- ─────────────────────────────────────────────────────────────
-- Категории
-- ─────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id        serial PRIMARY KEY,
  parent_id int REFERENCES categories(id) ON DELETE CASCADE,
  slug      text NOT NULL UNIQUE,
  name      text NOT NULL,
  path      ltree NOT NULL,          -- '1.14.87'
  sort      int  DEFAULT 0,
  is_active boolean DEFAULT true,

  -- SEO
  seo_title       text,
  seo_description text,
  image_url       text
);

CREATE INDEX categories_path_idx   ON categories USING GIST (path);
CREATE INDEX categories_parent_idx ON categories (parent_id);


-- ─────────────────────────────────────────────────────────────
-- Товары
-- ─────────────────────────────────────────────────────────────
CREATE TABLE products (
  id            serial PRIMARY KEY,
  sku           text UNIQUE NOT NULL,
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  description   text,
  image_url     text,

  price         numeric(12,2),
  stock         numeric(12,2) DEFAULT 0,
  stock_unit    text DEFAULT 'шт',      -- шт / м
  is_active     boolean DEFAULT true,

  category_id   int   NOT NULL REFERENCES categories(id),
  category_path ltree NOT NULL,          -- копия categories.path

  attrs         jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX products_catpath_idx ON products USING GIST (category_path);
CREATE INDEX products_attrs_idx   ON products USING GIN  (attrs jsonb_path_ops);
CREATE INDEX products_price_idx   ON products (price);
CREATE INDEX products_active_idx  ON products (is_active) WHERE is_active;
```

### Пример строки товара

```json
{
  "id": 4851,
  "sku": "100107.4",
  "slug": "100107-4-vreznoe-koltso",
  "name": "Врезное кольцо под трубку 12L, 400 бар",
  "price": 129.32,
  "stock": 18041,
  "category_id": 87,
  "category_path": "1.14.87",
  "attrs": {
    "fitting_type":  "koltso",
    "tube_diameter": "12l",
    "series":        "1001",
    "body_material": "stal-s-tsinkovym-pokrytiem",
    "conn_type":     "rezbovye",
    "pressure_max":  400
  }
}
```

В `attrs` лежат **слаги значений**, не подписи. Слаг идёт в URL и в сравнение,
подпись живёт в справочнике (см. раздел 8) или в словаре на фронте.

---

## 4. Два оператора ltree — вся навигация

| Оператор | Смысл | Применение |
|----------|-------|------------|
| `a <@ b` | `a` — потомок `b` (или равен) | список товаров категории |
| `a @> b` | `a` — предок `b` (или равен) | хлебные крошки |
| `nlevel(p)` | глубина пути | сортировка крошек, уровень вложенности |
| `subpath(p, n)` | хвост пути с позиции n | перенос ветки дерева |

---

## 5. Запросы страницы категории

### 5.1 Товары — работает на любом уровне

```sql
SELECT id, sku, slug, name, image_url, price, stock, stock_unit
FROM products
WHERE category_path <@ (SELECT path FROM categories WHERE slug = $1)
  AND is_active
ORDER BY stock DESC, id
LIMIT $2 OFFSET $3;
```

Один и тот же SQL для:

- `/catalog/gidravlika`     → `<@ '1'`        → вся ветка
- `/catalog/fitingi-i-rvd`  → `<@ '1.14'`     → поддерево
- `/catalog/fitingi`        → `<@ '1.14.87'`  → только листовая

### 5.2 Хлебные крошки

```sql
SELECT slug, name
FROM categories
WHERE path @> (SELECT path FROM categories WHERE slug = $1)
ORDER BY nlevel(path);
```

### 5.3 Плитки подкатегорий

```sql
SELECT slug, name, image_url
FROM categories
WHERE parent_id = (SELECT id FROM categories WHERE slug = $1)
  AND is_active
ORDER BY sort, name;
```

### 5.4 Счётчики для всего меню одним запросом

```sql
SELECT c.id, c.slug, count(p.id) AS cnt
FROM categories c
LEFT JOIN products p
       ON p.category_path <@ c.path AND p.is_active
GROUP BY c.id;
```

Для меню лучше держать это денормализованной колонкой
`categories.product_count` и пересчитывать на импорте — считать на каждый
рендер меню дорого.

### 5.5 Общее количество для пагинации

```sql
SELECT count(*) FROM products
WHERE category_path <@ (SELECT path FROM categories WHERE slug = $1)
  AND is_active;
```

---

## 6. Триггеры синхронизации

Чтобы `path` и `category_path` никогда не разъезжались руками.

```sql
-- путь категории строится от родителя
CREATE OR REPLACE FUNCTION sync_category_path() RETURNS trigger AS $$
BEGIN
  NEW.path := CASE
    WHEN NEW.parent_id IS NULL
      THEN NEW.id::text::ltree
    ELSE (SELECT path FROM categories WHERE id = NEW.parent_id) || NEW.id::text
  END;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_category_path
BEFORE INSERT OR UPDATE OF parent_id ON categories
FOR EACH ROW EXECUTE FUNCTION sync_category_path();


-- товар подтягивает путь своей категории
CREATE OR REPLACE FUNCTION sync_product_path() RETURNS trigger AS $$
BEGIN
  SELECT path INTO NEW.category_path
  FROM categories WHERE id = NEW.category_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_path
BEFORE INSERT OR UPDATE OF category_id ON products
FOR EACH ROW EXECUTE FUNCTION sync_product_path();
```

### Перенос ветки дерева

Единственная операция, которая требует массового пересчёта. Редкая,
вешается на кнопку в админке.

```sql
BEGIN;

-- $old — старый path переносимой категории, $new — новый
UPDATE categories
SET path = $new || subpath(path, nlevel($old))
WHERE path <@ $old;

UPDATE products
SET category_path = $new || subpath(category_path, nlevel($old))
WHERE category_path <@ $old;

COMMIT;
```

---

## 7. Next.js без отдельного бэкенда

```
app/
  catalog/
    [slug]/
      page.jsx          ← серверный компонент, ходит в БД напрямую
  api/
    catalog/[slug]/
      search/route.js   ← только для клиентских фетчей (фильтры, «показать ещё»)
lib/
  db.js
```

### lib/db.js

```js
import { Pool } from 'pg';

const g = globalThis;

export const db = g._pgPool ??= new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});
```

> `globalThis` обязателен. В dev-режиме Next перезагружает модули на каждое
> изменение файла, и без кэша в глобале ты за минуту исчерпаешь лимит
> соединений Postgres.

### app/catalog/[slug]/page.jsx

```jsx
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';

export const revalidate = 300;

export default async function CategoryPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;

  const [cat, crumbs, kids, products, total] = await Promise.all([
    db.query(
      `SELECT id, name, slug, seo_title, seo_description
       FROM categories WHERE slug = $1 AND is_active`, [slug]),

    db.query(
      `SELECT slug, name FROM categories
       WHERE path @> (SELECT path FROM categories WHERE slug = $1)
       ORDER BY nlevel(path)`, [slug]),

    db.query(
      `SELECT slug, name, image_url FROM categories
       WHERE parent_id = (SELECT id FROM categories WHERE slug = $1)
         AND is_active
       ORDER BY sort, name`, [slug]),

    db.query(
      `SELECT id, sku, slug, name, image_url, price, stock, stock_unit
       FROM products
       WHERE category_path <@ (SELECT path FROM categories WHERE slug = $1)
         AND is_active
       ORDER BY stock DESC, id
       LIMIT 24`, [slug]),

    db.query(
      `SELECT count(*)::int AS n FROM products
       WHERE category_path <@ (SELECT path FROM categories WHERE slug = $1)
         AND is_active`, [slug]),
  ]);

  if (!cat.rows[0]) notFound();

  return (
    <>
      <Breadcrumbs items={crumbs.rows} />
      <h1>{cat.rows[0].name}</h1>
      <SubcategoryTiles items={kids.rows} />
      <ProductGrid items={products.rows} total={total.rows[0].n} />
    </>
  );
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { rows } = await db.query(
    'SELECT name, seo_title, seo_description FROM categories WHERE slug = $1',
    [slug]);
  if (!rows[0]) return {};
  return {
    title: rows[0].seo_title ?? rows[0].name,
    description: rows[0].seo_description,
  };
}
```

Отдельный `/api/*` нужен **только** для клиентских действий без перезагрузки
страницы: клик по чекбоксу фильтра, кнопка «Показать ещё». Первый рендер
всегда идёт через серверный компонент — это SEO и скорость.

### URL

```
/catalog/fitingi?fitting_type=shtutser-pryamoy,troynik&price=100-5000&page=2
```

- Категория — **плоский** сегмент пути, не `/catalog/gidravlika/fitingi`.
  Слаг уникален, вложенность в URL ничего не даёт, а ломается при переносе
  ветки. Хлебные крошки строятся из `path`, не из URL.
- Фильтры — query-параметры. `?code=slug1,slug2` — OR внутри группы,
  разные ключи — AND между группами.

---

## 8. Фильтры

### 8.1 Подключение к запросу

Категория и фильтры — независимые предикаты в одном `WHERE`:

```sql
SELECT * FROM products
WHERE category_path <@ (SELECT path FROM categories WHERE slug = $1)
  AND attrs @> '{"fitting_type": "shtutser-pryamoy"}'::jsonb
  AND attrs->>'tube_diameter' = ANY($2)          -- OR внутри группы
  AND price BETWEEN $3 AND $4
  AND is_active;
```

### 8.2 Список доступных фильтров для категории

Выводится из самих товаров, ничего конфигурировать не надо:

```sql
SELECT
  kv.key                                AS code,
  jsonb_agg(DISTINCT kv.value)          AS values,
  count(DISTINCT p.id)                  AS coverage
FROM products p
CROSS JOIN LATERAL jsonb_each(p.attrs) AS kv
WHERE p.category_path <@ (SELECT path FROM categories WHERE slug = $1)
  AND p.is_active
GROUP BY kv.key
HAVING count(DISTINCT p.id) >= 5        -- отсекает мусорные атрибуты
ORDER BY coverage DESC;
```

### 8.3 Счётчики рядом с чекбоксами

Правило: счётчики внутри группы считаются по выборке, к которой применены
**все фильтры кроме этой группы**. Иначе выбрал одно значение — все остальные
показали `(0)` и чекбоксы стали мёртвыми.

```sql
WITH base AS (
  SELECT * FROM products
  WHERE category_path <@ (SELECT path FROM categories WHERE slug = $1)
    AND is_active
)
SELECT kv.key, kv.value, count(*)::int
FROM base p
CROSS JOIN LATERAL jsonb_each(p.attrs) AS kv
WHERE (p.attrs @> $2::jsonb OR kv.key = 'fitting_type')   -- своя группа себя не фильтрует
GROUP BY kv.key, kv.value;
```

Значения с нулём **дизейблятся, а не удаляются** — пропадающие опции ломают
ориентацию пользователя.

### 8.4 Когда jsonb станет мало

`attrs jsonb` — правильный старт: ноль лишних таблиц, GIN-индекс, всё в
карточке. Разносить на отдельные таблицы стоит, когда понадобится:

- нормальные подписи значений (`g1-4` → `G1/4"`),
- корректная сортировка размеров (`6L, 8L, 10L`, а не `10L, 6L, 8L`),
- защита от опечаток при импорте (`K1/8"` vs `K1/8''` — два разных фильтра),
- порядок фильтров в панели.

Тогда добавляются:

```sql
CREATE TABLE attributes (
  id        serial PRIMARY KEY,
  code      text UNIQUE NOT NULL,   -- 'fitting_type'
  name      text NOT NULL,          -- 'Тип фитинга'
  data_type text NOT NULL,          -- enum | number | bool
  unit      text,                   -- 'мм', 'бар'
  sort      int DEFAULT 100
);

CREATE TABLE attribute_values (
  id           serial PRIMARY KEY,
  attribute_id int NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  slug         text NOT NULL,       -- 'g1-4'  → идёт в URL и в attrs
  label        text NOT NULL,       -- 'G1/4"' → показывается человеку
  num_value    numeric,             -- 12 для '12L' → правильная сортировка
  sort         int DEFAULT 0,
  UNIQUE (attribute_id, slug)
);
```

`products.attrs` при этом **не меняется** — там по-прежнему слаги. Новые
таблицы это словарь для отображения, а не хранилище значений. Миграция
безболезненная, поэтому её спокойно можно отложить.

---

## 9. Товар в нескольких категориях

Если понадобится (товар лежит и в «Фитингах», и в «Акциях»), меняется одна
колонка:

```sql
ALTER TABLE products
  DROP COLUMN category_path,
  ADD COLUMN category_paths ltree[] NOT NULL DEFAULT '{}';

CREATE INDEX ON products USING GIST (category_paths);
```

Запрос почти не меняется — тот же оператор, только массив слева:

```sql
SELECT * FROM products
WHERE category_paths <@ (SELECT path FROM categories WHERE slug = $1);
```

Плюс колонка `primary_category_id` — «главная» категория для хлебных крошек
и canonical URL. Без неё товар в трёх категориях получит три URL с одинаковым
контентом, и поисковик склеит их как попало.

**Начинать с этого не надо.** Одна колонка `category_path` проще, а переход
на массив — одна миграция.

---

## 10. Итоговая сводка

| Таблица | Зачем | Обязательна |
|---------|-------|-------------|
| `categories` | дерево, SEO, навигация | да |
| `products` | товар + `attrs jsonb` | да |
| `attributes` | подписи и порядок фильтров | нет, потом |
| `attribute_values` | подписи и сортировка значений | нет, потом |

**Стартовый минимум — две таблицы.** Всё остальное добавляется поверх, не
ломая существующее.

Ключевые решения:

1. `ltree` вместо `parent_id`-рекурсии — вложенность любой глубины, ноль
   изменений в коде.
2. `category_path` копией на товаре — выборка категории без единого JOIN.
3. Слаг категории плоский и уникальный — URL не ломается при переносе ветки.
4. Категория и фильтры — независимые предикаты одного `WHERE`.
5. `attrs jsonb` на старте, словари атрибутов — когда прижмёт.
