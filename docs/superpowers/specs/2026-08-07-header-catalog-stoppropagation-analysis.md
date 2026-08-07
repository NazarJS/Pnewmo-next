# HeaderCatalog: разбор структуры подкомпонентов и stopPropagation

Анализ текущей реализации после разделения `HeaderCatalog` на подкомпоненты
(`MegaMenu`, `CategoryItem`, `MobileSubcategories`) и вынесения `useEffect`-логики
в `shared/hooks`. Изменения в код не вносились — только анализ.

## Текущая структура

```
HeaderCatalog.tsx                          — состояние (catalogActive, mobileCategoryActive), сборка дерева
├── shared/hooks/useIsDesktop.ts           — brakpoint > 1024px, свой resize-listener
├── shared/hooks/useLockBodyScroll.ts      — body.no-scroll пока isOpen
├── ui/CategoryItem/CategoryItem.tsx       — строка сайдбара: заголовок + мобильный аккордеон
│   └── ui/MobileSubcategories/…           — список подкатегорий внутри мобильного аккордеона
└── ui/MegaMenu/MegaMenu.tsx               — десктопная мега-панель справа
```

Разделение ответственности само по себе оправдано: `HeaderCatalog` был единственным
местом с пятью независимыми `useEffect` (загрузка категорий, resize/desktop-detect,
дефолтная активная категория, lock-scroll, сброс мобильного аккордеона при закрытии) —
вынос части из них в именованные хуки (`useIsDesktop`, `useLockBodyScroll`) действительно
снижает путаницу: по имени хука сразу понятно, за что он отвечает, в отличие от пяти
одинаковых на вид блоков `useEffect(() => {...}, [...])` подряд.

## Вопрос: `stopPropagation` в обработчиках — не избыточно ли это

В коде это встречается в двух местах:

```tsx
// CategoryItem.tsx — Link с названием категории в сайдбаре
<Link
  href={category.url}
  onClick={(event) => {
    event.stopPropagation();
    onClose?.();
  }}
>
```

```tsx
// MobileSubcategories.tsx — Link на каждую подкатегорию в мобильном аккордеоне
<Link
  href={child.url}
  onClick={(event) => {
    event.stopPropagation();
    onClose?.();
  }}
>
```

Чтобы ответить, избыточно ли это, для каждого вызова нужно найти **реального
предка с обработчиком клика**, которому `stopPropagation` мог бы помешать сработать —
не «на глаз», а по фактической DOM-цепочке.

### 1) `CategoryItem.tsx` — обоснованно (с оговоркой)

Реальная структура одной строки сайдбара:

```
<li onMouseEnter={...}>                                  ← CategoryItem
  <div className={category_header} onClick={onClick}>    ← toggleMobileCategory(categoryId)
    <Link onClick={(e) => { e.stopPropagation(); onClose?.(); }}>
      {category.name}
    </Link>
    ...стрелка...
  </div>
  <div className={mobile_accordion}>...</div>
</li>
```

`Link` — прямой потомок `div.category_header`, у которого **есть** свой `onClick`
(`toggleMobileCategory`). Без `stopPropagation` клик по названию категории всплыл бы
из `Link` в `div` и запустил бы оба обработчика за одно нажатие: сначала
`onClose?.()` (через `Link`), затем `toggleMobileCategory(categoryId)` (через `div`,
по всплытию).

Это не гипотетическая мелочь — есть конкретный сценарий поломки. `onClose` в
`HeaderCatalog.tsx` — это `handleClose`:

```ts
const handleClose = () => {
  setMobileCategoryActive(null);
  onClose?.();
};
```

React батчит оба вызова `setMobileCategoryActive` в рамках одного клика.
Порядок обработчиков при всплытии — сначала `Link` (ближе к цели клика), потом
`div` — значит порядок обновлений состояния:

1. `setMobileCategoryActive(null)` — из `handleClose` (через `Link`)
2. `setMobileCategoryActive(prev => prev === id ? null : id)` — из `toggleMobileCategory`
   (через `div`, следом по всплытию)

Функциональный апдейтер во втором вызове получает уже применённый результат
первого (`prev = null`), значит `null === id` → `false` → аккордеон **открывается**
(`id`), а не остаётся закрытым — прямо противоположно тому, что должен был сделать
`handleClose`.

**Но:** в текущей архитектуре это не проявляется на практике. `onClose` в мобильном
режиме — это `closeAll` из `useOpenInput`, который переводит `isMobileCatalogOpen`
в `false`, а `HeaderCatalog` в `HeaderPanel.tsx` рендерится условно —
`{isMobileCatalogOpen && <HeaderCatalog mobile ... />}`. Оба обновления состояния
(локальное в `CategoryItem`/`HeaderCatalog` и родительское в `HeaderPanel`)
попадают в один и тот же батч и один и тот же коммит — в итоге React вообще не
рендерит дерево с испорченным состоянием, компонент размонтируется раньше, чем
это стало бы заметно.

**Вывод:** сейчас это защита от бага, который замаскирован несвязанным
архитектурным решением (unmount-on-close), а не действующий баг. Оставлять
`stopPropagation` здесь стоит — это единственное, что явно разделяет два разных
действия (перейти по ссылке vs открыть аккордеон), не полагаясь на побочный эффект
условного рендера. Если позже `HeaderPanel` перейдёт на CSS-анимацию закрытия
вместо немедленного размонтирования (частый рефакторинг ради плавного закрытия) —
маскировка исчезнет, и без `stopPropagation` баг станет наблюдаемым.

### 2) `MobileSubcategories.tsx` — избыточно

Цепочка предков от `Link` до корня приложения:

```
<Link onClick={(e) => { e.stopPropagation(); onClose?.(); }}>   ← MobileSubcategories
  <li>                              — без обработчиков
    <ul className={mobile_subcategory_list}>   — без обработчиков
      <div className={mobile_accordion}>       — без обработчиков
        <li className={category_item} onMouseEnter={...}>   — есть только onMouseEnter, не onClick
          <ul className={categories_list}>     — без обработчиков
            <div className={sidebar}>          — без обработчиков
              ...вплоть до document — без обработчиков
```

`div.category_header` с `onClick={toggleMobileCategory}` (тот самый обработчик,
из-за которого `stopPropagation` оправдан в `CategoryItem`) — это **не предок**
`MobileSubcategories`, а его **сосед**: оба — прямые дети одного и того же `<li>`
(см. JSX `CategoryItem.tsx`, `category_header` и `mobile_accordion` — соседние
`div`, не один внутри другого). Клик внутри `mobile_accordion` физически не может
всплыть в `category_header` — это разные ветки дерева.

Дополнительно проверено по всему `src` (`grep -rn "addEventListener(\"click\"\|
mousedown\|useClickOutside\|useOutsideClick"`) — в проекте нет ни одного глобального
`click`/`mousedown`-листенера на `document`/`window`, который мог бы перехватывать
всплывшее событие откуда-либо ещё.

**Вывод:** здесь `stopPropagation` не останавливает ничего — выше по дереву нет ни
одного обработчика клика, который событие могло бы задеть. Похоже на копипаст
паттерна из `CategoryItem.tsx` по аналогии, без проверки, что в этом конкретном
месте предка с `onClick` не существует. Не ломает функциональность, но:
и не защищает ни от чего — можно убрать без последствий, оставив просто
`onClick={onClose}` (как уже сделано в `MegaMenu.tsx`, где `stopPropagation`
не использован вовсе — там та же ситуация, предка-обработчика нет).

## Побочная находка (не по теме вопроса, но замечена по ходу)

`HeaderCatalog.tsx`, строки 128–130 — заголовок мега-меню:

```tsx
<h3 className={styles.categories_title}>
  <Link href={activeCategory.url}>{activeCategory.name}</Link>
</h3>
```

У этой ссылки нет `onClick={handleClose}` — та же самая проблема, что уже
разбиралась и была исправлена в дорефакторинговой версии компонента (ссылка ведёт
на страницу товаров, но каталог не закрывается, и список товаров остаётся под
раскрытой панелью). Похоже, фикс не перенесли при разбиении компонента на
подфайлы. Не исправляю — просто фиксирую, раз увидел при разборе того же файла.

## Итог

| Вызов | Обоснован? | Почему |
|---|---|---|
| `CategoryItem.tsx` (заголовок категории) | Да, с оговоркой | Реальный предок с `onClick` есть; баг при всплытии подтверждён логически, но сейчас замаскирован unmount-on-close — стоит оставить как защиту от будущих рефакторингов анимации закрытия |
| `MobileSubcategories.tsx` (подкатегории) | Нет | Предка с `onClick` в DOM-цепочке нет вообще (соседний, не родительский `div`), глобальных click-листенеров в проекте тоже нет — код не выполняет никакой защитной функции |
