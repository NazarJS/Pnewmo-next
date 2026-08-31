# Принципы: где чему место и почему

Примеры — из `apps/web`. Стайлгайд отвечает на вопрос «как написать», этот документ —
на «почему именно так».

---

## SRP: одна причина для изменения

### Разделение по слоям

| Слой | Отвечает за | Не должен содержать |
|---|---|---|
| Page / Server Component | получение данных, композицию | хуков состояния, обработчиков событий |
| Client Component (контейнер) | состояние, вызов хуков запросов, обработчики | вёрстки бизнес-смысла, прямых `fetch` |
| Presentational-компонент | вёрстку по пропсам | знания о `useQuery`, роутинге, сторах |
| Хук `use<Feature>` | инкапсуляцию запроса/состояния для фичи | JSX |

Проверка на практике — компонент, у которого в файле встречается и JSX с вёрсткой, и
`useQuery`/`useMutation`, и презентационная разметка на 100+ строк, почти наверняка
стоит разделить на контейнер и presentational-часть.

```bash
grep -rln 'useQuery\|useMutation' apps/web/src/{entities,features,widgets} --include='*.tsx' \
  | xargs grep -l 'className='
```

Если файл одновременно дёргает запрос и содержит развёрнутую вёрстку — слой протёк.
Не обязательно ошибка, но повод посмотреть, не пора ли выделить presentational-компонент.

### Правильно: хук и композиция в одном компоненте, презентационная часть — отдельно

Проект не заводит отдельный файл `*.container.tsx` на каждую фичу — «контейнерная»
роль (вызов хука, состояния загрузки/ошибки, композиция) и верхнеуровневая разметка
живут в одном клиентском компоненте, а отдельным файлом выносится вложенная
презентационная часть, когда она достаточно самостоятельна для переиспользования.
Реальный пример — `widgets/product-grid`:

```tsx
// widgets/product-grid/ProductGrid.tsx
'use client';

const ProductGrid = ({ categoryId }: ProductGridProps) => {
  const { offset, limit } = useCatalogUrlState();
  const query = useProductList({ categoryId, offset, limit }); // хук — из entities/product/api/hook.ts

  // Одна деривация состояний вместо трёх ранних return — lib/deriveProductGridState.ts
  const { message, data } = deriveProductGridState(query);

  return (
    <>
      {message && <p>{message}</p>}
      {data && (
        <div className={styles.grid}>
          {data.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
};

export default ProductGrid;
```

```tsx
// widgets/product-grid/ui/ProductCard/ProductCard.tsx — presentational, без "use client"
const ProductCard = ({ product }: ProductCardProps) => (
  <Link href={`/product/${product.id}`} className={styles.card}>
    ...
  </Link>
);

export default ProductCard;
```

`ProductGrid` знает про `useProductList`/`useCatalogUrlState` и состояния загрузки.
`ProductCard` получает готовый `product` пропом и не знает, откуда он взялся — его можно
отрендерить в тесте без сети и без `QueryClient`. Деривация состояний загрузки/ошибки/
пустого списка — чистая функция в `lib/`, а не ранние `return` внутри компонента,
подробнее — `.claude/context/frontend-data-layer.md`. GET-хук лежит в сущности
(`entities/product`), а не в виджете — виджет его только вызывает; правило и причина —
скилл `component-structure`.

### Неправильно: всё в одном компоненте

```tsx
// ❌ Три нарушения сразу
'use client';

export function CategoryPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]); // ручной стейт вместо useQuery
  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then(setCategories); // fetch в компоненте
  }, []);

  return (
    <div className="p-4">
      {categories.map((c) => (
        <div key={c.id} className="border-b py-2">{c.name}</div> // вёрстка и данные вперемешку
      ))}
    </div>
  );
}
```

### Неправильно: бизнес-логика в presentational-компоненте

```tsx
// ❌ Компонент, который должен только рисовать список, сам решает, что показывать
function CategoryList({ categories }: { categories: CategoryRow[] }) {
  const visible = categories.filter((c) => c.isActive && c.parentId === null); // фильтрация — дело контейнера/хука
  return <ul>{visible.map((c) => <li key={c.id}>{c.name}</li>)}</ul>;
}
```

### Когда делить компонент

Больше 200–250 строк, JSX с более чем 3 уровнями условного рендеринга внутри одного
return, либо кусок вёрстки используется в другом месте. До этого — один файл. Заводить
`CategoryListUtils.tsx` на один хелпер незачем.

---

## DIP: зависеть от того, что можешь подменить

Presentational-компонент зависит от формы пропсов, а не от `useQuery` или конкретного
эндпоинта. Практическое следствие — компонент можно отрендерить в тесте без сети и без
`QueryClient` (Storybook в проекте не подключён — граница проверяется рендер-тестом,
`@testing-library/react` на jsdom-проекте Jest, как `HeaderCatalog.spec.tsx`):

```tsx
// widgets/product-grid/ui/ProductCard/ProductCard.spec.tsx (пример, файла пока нет)
render(<ProductCard product={{ id: '1', name: 'Насос', price: 12000, imageUrl: '/x.jpg' }} />);
```

Хук `useProductList`/`useCategories` при этом не оборачивается в отдельный интерфейс
«на случай замены TanStack Query» — сам хук служит границей. Абстракция над клиентом
данных появится, когда реально появится вторая реализация (например, второй источник
данных), а не заранее.

---

## KISS: простое решение, пока сложное не понадобилось

### Мемоизация не по умолчанию

```tsx
// ❌ useMemo/useCallback на каждый чих
const total = useMemo(() => items.length, [items]); // дешевле пересчитать без мемо

// ✅ Мемоизация там, где действительно дорогое вычисление или стабильность
// ссылки важна для зависимостей нижестоящего useEffect/memo
const sorted = useMemo(() => items.toSorted(byName), [items]);
```

React 19 сам оптимизирует часть простых случаев (компилятор). Мемоизация — инструмент
под конкретную проблему (дорогое вычисление, стабильность ссылки для `memo`/зависимостей),
а не привычка, применяемая ко всему подряд.

### Дерево категорий собирается на клиенте из плоского списка

Категорий сорок. Один плоский запрос и сборка дерева в `useMemo` на клиенте дешевле
и проще, чем повторный рекурсивный эндпоинт под каждое представление. Отдельный
серверный endpoint под дерево появится, когда категорий станут тысячи и сборка на
клиенте станет заметно дорогой.

### Чего не делать

```tsx
// ❌ Обёртка «чтобы можно было заменить TanStack Query»
function useDataFetcher<T>(key: string, fetcher: () => Promise<T>) {
  // повторяет useQuery, но без кэша, retry, devtools
}
```

Теряются кэширование, инвалидация, devtools — всё, ради чего подключён TanStack Query,
а сама библиотека всё равно никогда не меняется без пересмотра всего data layer.

---

## DRY: один источник правды, но не любое совпадение

### Что действительно нельзя дублировать

**Токены дизайна.** Цвет, отступ, breakpoint определяются один раз в `@theme` и
используются везде как утилита или CSS-переменная:

```css
/* globals.css */
@theme {
  --color-brand: oklch(0.62 0.19 256);
  --spacing-card: 1.25rem;
}
```

```tsx
<div className="bg-(--color-brand) p-(--spacing-card)" />
```

Значение, продублированное как произвольное `bg-[#3b5bdb]` в другом компоненте,
разойдётся с токеном при первой же правке дизайна.

**Ключи запросов.** Один билдер `lib/queryKey.ts` на сущность — его зовут и клиентский
хук, и серверный префетч, а не строка, набранная руками в каждом месте вызова:

```ts
// entities/product/lib/queryKey.ts
export const PRODUCT_LIST_QUERY_KEY_PREFIX = 'product-list' as const;

export const buildProductListQueryKey = (filter: ProductListFilterState) =>
  [PRODUCT_LIST_QUERY_KEY_PREFIX, filter.categoryId ?? null, filter.offset, filter.limit] as const;
```

Опечатка в строковом литерале префикса в одном месте — и инвалидация после мутации молча
перестаёт работать. Ключ — позиционный массив, а не объектная factory с
`JSON.stringify`; полное правило (включая отдельный билдер тела запроса и почему их
два) — `.claude/context/frontend-data-layer.md`.

### Где дублирование осознанное

Валидация формы на клиенте (мгновенная обратная связь) дублирует валидацию на
сервере через тот же Zod-контракт. Это не нарушение: клиентская проверка — UX, серверная
— граница безопасности, полагаться только на клиентскую нельзя.

Правило: дублировать **проверку ради UX** можно, дублировать **схему данных или токен
дизайна как отдельный литерал** нельзя — для схемы данных используется тот же Zod-схема
из `packages/api-contract`, для дизайна — тот же токен `@theme`.

---

## Presentational-компонент не знает про data fetching

Presentational-компонент принимает данные и колбэки пропсами, не импортирует
`useQuery`/`useMutation` и не знает, что данные вообще откуда-то приходят:

```tsx
type CategoryFormProps = {
  defaultValues: CategoryFormValues;
  onSubmit: (values: CategoryFormValues) => void;
  isSubmitting: boolean;
};

export function CategoryForm({ defaultValues, onSubmit, isSubmitting }: CategoryFormProps) {
  // только форма и вёрстка
}
```

Смысл границы: одну и ту же форму можно использовать и для создания, и для
редактирования, подключив к разным мутациям снаружи, и её можно протестировать без
сети и без провайдера `QueryClient`.

### Server Component против Client Component

Данные, которые не меняются в ответ на действия пользователя на этой же странице,
получает Server Component — без "use client", без пропущенного через клиент JS.
"use client" ставится на границе, где начинается интерактивность (обработчики, стейт,
эффекты), а не на весь поддерево вверх по дереву компонентов «на всякий случай».

```tsx
// app/catalog/[slug]/page.tsx — Server Component, без "use client"
export default async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  // ...разбор params/searchParams, поиск категории...
  await prefetchProductList(queryClient, filter); // серверный префетч, не хук и не fetch в теле компонента
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductGrid categoryId={category.id} /> {/* клиентский компонент читает уже прогретый кэш */}
    </HydrationBoundary>
  );
}
```

Виджет не получает данные пропом (`initialData`) — он читает их из уже прогретого
кэша тем же ключом, которым его наполнил префетч; механика —
`.claude/context/frontend-data-layer.md`.

---

## Строгая типизация

`any` не используется. Для данных неизвестной формы — `unknown` с явными проверками,
как при разборе ответа стороннего виджета, форма которого не описана Zod-схемой.

Приведение типа допустимо, когда система типов не может знать того, что знаем мы, и это
объясняется комментарием:

```ts
// DOM-элемент точно существует к этому моменту: ref выставляется в useEffect
// после монтирования, до размонтирования эффект не запускается.
const node = ref.current as HTMLDivElement;
```

Тип пропсов компонента объявляется явно, а не выводится из использования — так его
видно в одном месте и можно переиспользовать в тестах. Где именно объявляется
(`lib/types.ts` слайса, с одним исключением для файлов маршрутов Next) — не повторяется
здесь во избежание второй копии, которая разойдётся с первой; правило — скилл
`component-structure`.

---

## Что проверяет каждый инструмент

| Инструмент | Проверяет | Не проверяет |
|---|---|---|
| TypeScript (`tsc`) | форму данных, пропсы, возвращаемые типы | поведение в рантайме, доступность |
| ESLint | Rules of Hooks, зависимости эффектов, неиспользуемый код | вёрстку, стили |
| stylelint | порядок свойств, синтаксис SCSS, дублирование значений | JS/TS-логику |
| Браузер / рантайм | реальную гидратацию, доступность, производительность | то, что уже поймали статические проверки |

Если что-то можно поймать типами или линтером — это не повод оставлять на ревью
«на глаз»: значит, в конфиге ESLint/stylelint не хватает правила, а не что ревьюер
должен держать это в голове каждый раз.
