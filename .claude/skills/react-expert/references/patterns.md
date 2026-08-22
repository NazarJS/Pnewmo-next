# Паттерны, антипаттерны и чеклист ревью

---

## Порядок создания фичи

1. **Ключи запросов** в `features/<feature>/<feature>.keys.ts` — factory для
   `queryKey`, используется и в хуке, и при инвалидации после мутаций.
2. **Хук данных** в `features/<feature>/use-<feature>.ts` — `useQuery`/`useMutation`
   поверх клиента API, ничего про JSX.
3. **Presentational-компоненты** в `features/<feature>/*.tsx` — принимают данные и
   колбэки пропсами, без "use client", если сами не используют хуки/эффекты.
4. **Контейнер** в `features/<feature>/<feature>.container.tsx` — "use client",
   вызывает хук данных, передаёт результат в presentational-компонент, обрабатывает
   `isPending`/`isError`.
5. **Страница** в `app/<route>/page.tsx` — Server Component, получает начальные
   данные (если нужен SSR) и рендерит контейнер.
6. Стили — рядом с компонентом (`*.module.scss`) для нестандартной вёрстки, Tailwind
   для всего, что укладывается в утилиты.

**Экспорт зависит от типа файла, не от слоя.** Компонент (`.tsx`) — всегда
`export default` снизу файла: `const ProductFilterPanel = (...) => {...}; export default
ProductFilterPanel;` — так зафиксировано в `component-structure` и подтверждено планом
на `ProductFilterPanel` (`docs/superpowers/plans/2026-08-13-product-filter-ui-plan.md`,
шаг 3). Хук (`useXxx`) — всегда именованный экспорт: `export const useCategories = ...`,
как в `entities/category/hooks/useCategories.ts`. Это касается `entities/`, `features/`,
`widgets/` и `shared/` одинаково — деления по слою здесь нет.

## Шаблон хука данных

```ts
// features/categories/use-categories.ts
export function useCategories() {
  return useQuery({
    queryKey: categoriesKeys.list(),
    queryFn: () => apiClient.categories.list(),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => apiClient.categories.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKeys.list() });
    },
  });
}
```

`queryKey` берётся из factory, а не набирается строкой — один источник правды на весь
модуль, невозможно разойтись между хуком чтения и инвалидацией после мутации.

Хук под задачу, а не универсальный:

```ts
// Форме редактирования нужна только одна категория — не тянем весь список
export function useCategory(id: number) {
  return useQuery({
    queryKey: categoriesKeys.detail(id),
    queryFn: () => apiClient.categories.getById(id),
  });
}
```

## Шаблон контейнера

```tsx
'use client';

const CategoryListContainer = ({ initialData }: { initialData?: CategoryRow[] }) => {
  const { data, isPending, isError } = useCategories({ initialData });

  if (isError) {
    return <CategoryListError />;
  }

  if (isPending) {
    return <CategoryListSkeleton />;
  }

  return <CategoryList categories={data} />;
};

export default CategoryListContainer;
```

Состояния загрузки и ошибки обрабатываются явно, каждое своим presentational-компонентом,
а не одной веткой `{isPending ? 'Загрузка...' : ...}` внутри вёрстки списка.

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

Разделить на контейнеры по фиче и presentational-компоненты по назначению.

### Протекающая абстракция

```ts
// ❌ Хук отдаёт наружу сырой результат useQuery целиком
function useCategories() {
  return useQuery({ queryKey: categoriesKeys.list(), queryFn: fetchCategories });
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

- [ ] `queryKey` берётся из factory, не строковый литерал
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
- [ ] Пропсы компонента типизированы явно, тип объявлен рядом с компонентом
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
