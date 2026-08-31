# Паттерны, антипаттерны и чеклист ревью

---

## Порядок создания слайса

Раскладка файлов, именование и то, куда класть тип пропсов — в скилле
`component-structure`; здесь — порядок, в котором эти файлы имеет смысл писать.

1. **Ключи запросов** в `lib/queryKey.ts` — билдер ключа (и, если у запроса есть
   параметры тела помимо ключа, отдельный билдер тела), используется и в клиентском
   хуке, и в серверном префетче, и при инвалидации после мутаций. Полное правило —
   `.claude/context/frontend-data-layer.md`.
2. **Хук данных** в `api/hook.ts` — `useQuery`/`useMutation` поверх ts-rest, ничего про
   JSX. Живёт в сущности (`entities/`), если данные нужны больше чем одному
   feature/widget, иначе — в фиче/виджете, который его единственный потребитель.
3. **Presentational-компоненты** в `ui/<Name>/<Name>.tsx` — принимают данные и колбэки
   пропсами, без `"use client"`, если сами не используют хуки/эффекты.
4. **Композиция** — в корневом компоненте слайса (`<Widget>.tsx`/`<Feature>.tsx`).
   Отдельного файла `*.container.tsx` в проекте нет: он же вызывает хук данных, он же
   обрабатывает `isPending`/`isError` (через единую деривацию — см. «Шаблон деривации
   состояний» ниже) и композирует presentational-часть. Разделяется на два файла не по
   жёсткому правилу «контейнер отдельно», а когда компонент перерастает порог из
   `principles.md` («Когда делить компонент»).
5. **Страница** в `app/<route>/page.tsx` — Server Component, получает начальные данные
   через серверный префетч (если нужен SSR) и рендерит виджет внутри
   `HydrationBoundary`. Пропсы страницы — исключение из правила «типы не в `.tsx`»,
   объявляются инлайн (`component-structure`).
6. Стили — рядом с компонентом (`*.module.scss`) для нестандартной вёрстки, Tailwind
   для всего, что укладывается в утилиты.

**Экспорт зависит от типа файла, не от слоя.** Компонент (`.tsx`) — всегда
`export default` снизу файла: `const ProductFilterPanel = (...) => {...}; export default
ProductFilterPanel;` — так зафиксировано в `component-structure` и подтверждено планом
на `ProductFilterPanel` (`docs/superpowers/plans/2026-08-13-product-filter-ui-plan.md`,
шаг 3). Хук (`useXxx`) — всегда именованный экспорт: `export const useCategories = ...`,
как в `entities/category/api/hook.ts`. Это касается `entities/`, `features/`,
`widgets/` и `shared/` одинаково — деления по слою здесь нет.

## Шаблон хука данных

```ts
// entities/product/api/hook.ts
export const useProductList = (filter: ProductListFilterState) =>
  tsr.products.list.useQuery({
    queryKey: buildProductListQueryKey(filter), // тот же билдер, что у серверного префетча
    queryData: { query: buildProductListQuery(filter) },
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
```

Ключ строится билдером (`lib/queryKey.ts`), а не набирается строкой на месте — один
источник правды и на клиентский хук, и на серверный префетч, и на инвалидацию после
мутации. Почему тело запроса собирается отдельным вторым билдером, а не тем же самым —
`.claude/context/frontend-data-layer.md`.

Хук под задачу, а не универсальный: `entities/product` не заводит `useProduct(id)`
«на всякий случай» рядом с `useProductList` — страница товара сегодня читает данные
напрямую через `api.products.getById` (server-side), без клиентского хука, потому что
клиентской интерактивности там пока нет.

## Шаблон деривации состояний

Единая функция, а не ранние `return` внутри компонента:

```ts
// widgets/product-grid/lib/deriveProductGridState.ts
export function deriveProductGridState({ isPending, data }: ProductListQueryState): ProductGridState {
  const isLoading = isPending;
  const isError = !isLoading && !isSuccessResponse(data);
  const isEmpty = !isLoading && isSuccessResponse(data) && data.body.total === 0;
  const message = isLoading ? 'Загрузка...' : isError ? 'Не удалось загрузить товары' : isEmpty ? '...' : null;

  return { isLoading, isError, isEmpty, message, data: message === null && isSuccessResponse(data) ? data.body : null };
}
```

Компонент рендерит по `message`/`data`, не по трём отдельным `isPending`/`isError`/
`isEmpty`, каждое своей веткой JSX — деривация уже решила, что показывать. Подробнее,
включая почему функция типизирована минимальной формой хука, а не
`ReturnType<typeof useProductList>` целиком — `.claude/context/frontend-data-layer.md`.

## Обход дерева со страховкой

```ts
function buildTree(categories: CategoryRow[]): CategoryTreeNode[] {
  const visited = new Set<number>();

  function attachChildren(parentId: number | null): CategoryTreeNode[] {
    return categories
      .filter((category) => category.parentId === parentId)
      .map((category) => {
        // Страховка от уже испорченных данных: если цикл каким-то образом попал
        // в ответ API, сборка дерева не должна зависнуть.
        if (visited.has(category.id)) {
          return { ...category, children: [] };
        }

        visited.add(category.id);

        return { ...category, children: attachChildren(category.id) };
      });
  }

  return attachChildren(null);
}
```

Любая сборка дерева из плоского списка, пришедшего с сервера, получает `visited` —
клиент не должен зависать из-за данных, которые могли испортиться до появления проверки.
Не гипотетическое правило — применено буквально в
`entities/category/lib/categoryTree.ts`, `findRootCategoryIdBySlug`: обход вверх по
`parent_id` от текущей категории к корню держит `visited`, а комментарий в файле прямо
ссылается на этот пункт скилла.

---

## Таблица замен: паттерны Pages Router / React ниже 19 → этот проект

Большинство материалов в интернете написаны под Pages Router или React 18.
Соответствия:

| Pages Router / React 18 | App Router / React 19 (этот проект) |
|---|---|
| `getServerSideProps` | `async function Page()` — Server Component |
| `getStaticProps` + ISR вручную | `fetch` с `next: { revalidate }` в Server Component |
| `useEffect` + `fetch` при монтировании | `useQuery` (клиент) или прямой `await` (сервер) |
| `_app.tsx` для глобальных провайдеров | `app/layout.tsx` |
| `next/head` | экспорт `metadata`/`generateMetadata` |
| `forwardRef` для проброса ref | `ref` как обычный проп |
| `useState` + ручной `onSubmit`/`preventDefault` для форм с серверным экшеном | `useActionState`/`useFormStatus` |
| `getInitialProps` | не используется; серверные данные — через Server Component |
| Class-компоненты с `componentDidMount` | функциональные компоненты с хуками |

Переносится без изменений: SRP по слоям (страница → контейнер → presentational),
запрет `any`, явные типы пропсов, DRY для токенов дизайна и ключей запросов, запрет
God Component, Prop Drilling через много уровней, Silent Errors и преждевременных
абстракций.

---

## Антипаттерны

### God Component

```tsx
// ❌ Компонент одновременно фильтрует, сортирует, дёргает три запроса и рисует форму
export function CategoriesPage() {
  const { data: categories } = useCategories();
  const { data: products } = useProducts();
  const { data: user } = useCurrentUser();
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'name' | 'date'>('name');
  // ...300 строк JSX ниже
}
```

Разделить: хуки данных — в сущность/фичу, фильтрация и сортировка — в чистую функцию
или `useMemo`, вёрстка — на presentational-компоненты по назначению.

### Протекающая абстракция

```ts
// ❌ Хук отдаёт наружу сырой результат useQuery целиком
function useCategories() {
  return tsr.categories.list.useQuery({ queryKey: CATEGORY_LIST_QUERY_KEY, queryData: {} });
}

// Компонент вынужден знать про isPending/isError/isFetching/данные TanStack Query
// вместо простого «готово / загрузка / ошибка» — это ещё не сама протечка, но она
// начинается, когда наружу дополнительно отдают queryClient или internal-поля.
```

Настоящая протечка — когда наружу уходит `queryClient` или неймспейс TanStack Query,
а не готовый к использованию результат.

### Магические строки

```tsx
if (status === 'active') { /* ... */ }         // ❌ в компоненте
className={cn(variant === 'primary' && ...)}   // ❌ строковый литерал варианта
```

Статусы и варианты — типизированные union или перечисление рядом с фичей, а не
строки, набранные заново в каждом месте использования.

### Проглоченная ошибка

```tsx
// ❌ Ошибка исчезла, пользователь не узнает, что форма не отправилась
async function handleSubmit(values: CategoryFormValues) {
  try {
    await createCategory(values);
  } catch {
    // ничего
  }
}
```

Либо показать состояние ошибки пользователю (тост, инлайн-сообщение), либо пробросить
выше. `onError` в `useMutation` — для этого.

### Ручной `fetch` + `useEffect` вместо `useQuery`

```tsx
// ❌ Заново собирает то, что уже даёт TanStack Query: кэш, retry, дедупликацию
const [data, setData] = useState<CategoryRow[]>([]);
useEffect(() => {
  fetch('/api/categories').then((r) => r.json()).then(setData);
}, []);
```

Такой запрос не кэшируется между компонентами, не переживает переход между страницами,
не отменяется при размонтировании, не имеет состояния ошибки из коробки.

### Over-fetching в компоненте

```tsx
// ❌ Тянется весь список категорий ради одного имени в хлебных крошках
const { data: categories } = useCategories();
const currentName = categories?.find((c) => c.id === currentId)?.name;

// ✅ Отдельный узкий запрос под задачу
const { data: current } = useCategory(currentId);
```

### Мутация пропсов/состояния

```tsx
// ❌ Изменение пришедшего объекта
function normalize(category: CategoryRow) {
  category.slug = category.slug.toLowerCase();
  return category;
}

// ✅ Новый объект
function normalize(category: CategoryRow): CategoryRow {
  return { ...category, slug: category.slug.toLowerCase() };
}
```

### Произвольные значения вместо токенов Tailwind

```tsx
// ❌ Значение мимо дизайн-системы, разойдётся при следующем ребрендинге
<div className="text-[15px] text-[#3b5bdb] mt-[13px]" />

// ✅ Токен из @theme или ближайшее стандартное значение шкалы
<div className="text-sm text-(--color-brand) mt-3" />
```

Произвольное значение — не всегда ошибка (иногда дизайн действительно требует
нестандартное число), но каждое такое место стоит вопроса «это токен, который забыли
завести, или осознанное исключение».

### Преждевременная абстракция

`useGenericFetcher`, `BaseCard`/`withLayout`-обёртки без второго варианта использования,
контекст-провайдер под состояние, которое нужно только одному компоненту, интерфейс
пропсов с единственной реализацией. Всё это добавляется, когда появляется вторая
реализация, а не в ожидании её.

---

## Чеклист код-ревью

### Слои

- [ ] "use client" стоит только там, где реально нужны хуки состояния/эффекты/браузерные API
- [ ] Presentational-компонент не импортирует `useQuery`/`useMutation`
- [ ] Данные с сервера, не зависящие от интерактивности, читает Server Component
- [ ] Бизнес-фильтрация/сортировка не зашита в presentational-компонент

### Данные (TanStack Query)

- [ ] `queryKey` берётся из билдера в `lib/queryKey.ts`, не строковый литерал
- [ ] Мутация инвалидирует связанные запросы через `onSuccess`
- [ ] Есть обработка `isPending` и `isError`, каждое — явным состоянием UI
- [ ] Нет `useEffect` + `fetch` там, где должен быть `useQuery`
- [ ] Хук узкий, под конкретную задачу, а не «получить всё на всякий случай»

### React 19 / хуки

- [ ] Нет нарушений Rules of Hooks
- [ ] Зависимости `useEffect`/`useMemo`/`useCallback` полные и не избыточные
- [ ] `key` в списках — стабильный id, не индекс массива
- [ ] Нет `AbortController`-утечки: запрос, начатый в эффекте, отменяется при
      размонтировании, если это важно для корректности

### Стили (Tailwind v4 / SCSS)

- [ ] Новые цвета/отступы/breakpoint заведены как токен в `@theme`, а не как
      произвольное значение
- [ ] Нет `tailwind.config.js`, заведённого «по привычке» без причины в CSS-first проекте
- [ ] Порядок свойств и вложенность SCSS соответствуют `stylelint-order`
- [ ] Значения, которые должны попасть под `postcss-pxtorem`, не исключены из
      конвертации случайно (`propList` в конфиге)

### Типы

- [ ] Нет `any`; для неизвестной формы — `unknown` с проверками
- [ ] Пропсы компонента типизированы явно, тип лежит в `lib/types.ts` слайса (кроме
      файлов маршрутов Next — там инлайн, `component-structure`)
- [ ] Приведение типа объяснено комментарием

### Доступность

- [ ] Интерактивные элементы — семантические теги или с ролью и обработкой клавиатуры
- [ ] Значимые изображения — с `alt`, декоративные — с пустым `alt=""`
- [ ] Фокус не теряется при открытии/закрытии модалок и дропдаунов

### Простота

- [ ] Нет обёрток над `useQuery`/`fetch` «на случай замены библиотеки»
- [ ] Нет контекст-провайдеров под состояние одного компонента
- [ ] Нет утилит для одноразовой операции
- [ ] Комментарии объясняют причину, а не пересказывают код

### Не придираться

Паттерн, применённый по всей кодовой базе, замечанием не является — если он неверен,
это отдельная задача на весь код, а не претензия к текущему диффу. Предложения вне
границ изменения — тоже не замечания.
