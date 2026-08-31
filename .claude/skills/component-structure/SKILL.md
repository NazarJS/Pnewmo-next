---
name: component-structure
description: Use when creating or restructuring React/Next.js components in this project — deciding where a file goes, how to name folders/files, which export style to use, where types live, or how to colocate styles
---

# Component Structure

## Overview

Project uses Feature-Sliced Design under `src/`: `app/`, `entities/`, `features/`,
`widgets/`, `shared/`. This skill captures the conventions actually used in the code so
new slices and components stay consistent. For the data layer (query keys, prefetch,
cache, error classification) see `.claude/context/frontend-data-layer.md` — this skill
covers file placement and component shape only.

## Layers — what goes where, by example

- `entities/` — a domain object read by more than one feature/widget. `entities/product`
  (card shape, price formatting, `useProductList`, the product query key) is read by both
  the storefront grid (`widgets/product-grid`) and the admin form
  (`features/catalog-admin`); `entities/category` (tree helpers, `useCategories`) is read
  by the header menu, the catalog page and both admin forms.
  **GET data hooks live here (`api/hook.ts`), not in the widget** — a deliberate
  deviation from the reference project this layout is modeled on (there, GET hooks live
  inside the table widget). Here the admin needs the same product/category list the
  storefront uses, so the hook has to sit above the widget layer, in the entity both
  sides import.
  No entity currently has its own `ui/` folder — presentational components for a product
  or category live in the widget that renders them (`widgets/product-grid/ui/ProductCard`),
  not in the entity. That's the current state, not a rule against ever adding one.
- `features/` — a user action. `features/catalog-admin` (create-category/create-product
  forms, mutations, cache reset after success).
- `widgets/` — a composite page section that orchestrates entities/features:
  `widgets/product-grid` (grid + pagination + card), `widgets/header`, `widgets/footer`.
- `shared/` — no domain: `api/` (ts-rest clients), `hooks/` (`useIsDesktop`,
  `useLockBodyScroll` — used by more than one slice), `lib/` (`getQueryClient`,
  `queryClient`, `apiError`, `cacheRevalidateSeconds`, `pagination`), `providers/`,
  `ui/icons/`.

No `pages` layer — routing is `app/` (App Router). No formal `processes`.

## Slice layout — fixed file names

Inside a slice, files that exist follow a fixed name, so nobody invents one per slice or
repeats the entity's name in the filename:

| File | Holds | Example |
|---|---|---|
| `api/hook.ts` | client TanStack Query hooks (`useX`) | `entities/product/api/hook.ts` → `useProductList` |
| `api/prefetch.ts` | server prefetch, never imported by a client component | `entities/product/api/prefetch.ts` → `prefetchProductList` |
| `lib/queryKey.ts` | query key builder + query body builder for the same request | `entities/product/lib/queryKey.ts` |
| `lib/types.ts` | every prop/value type for the slice's components **and** its sub-components | `widgets/product-grid/lib/types.ts`, `features/catalog-admin/lib/types.ts`, `widgets/header/lib/types.ts` |
| `lib/constants.ts` | slice constants | `entities/product/lib/constants.ts` |
| `hooks/` | client hooks — either derived from browser/router state (`useSearchParams`, `usePathname`) or local component state extracted for reuse | `entities/product/hooks/useCatalogUrlState.ts`, `widgets/header/ui/header-panel/hooks/useOpenInput.tsx` |

Not every slice has every file — only what's needed. `entities/category` has no
`lib/constants.ts` (nothing to name) and no query-body builder in `lib/queryKey.ts`
(its query has no parameters — see `.claude/context/frontend-data-layer.md`).

`hooks/` vs `lib/`: `lib/` is React-free — pure functions, testable without a DOM
(`parseCatalogUrlState`, `categoryTree.ts`). A file that calls a React hook goes in
`hooks/` instead, one level up from `lib/`, even when it's a thin wrapper around a `lib/`
function. `hooks/` is placed next to where it's used, at whatever depth that is — a
widget-local hook two folders deep (`header-panel/hooks/useOpenInput.tsx`) follows the
same rule as an entity-level one.

## Types: one file per slice, not inline — with one exception

Component and hook prop types are declared in `lib/types.ts`, not as an inline
`interface` above the component. One file per slice, shared by the slice's root
component and all its `ui/` sub-components — not one file per component:

```ts
// widgets/header/lib/types.ts
export interface HeaderCatalogProps { showSearch?: boolean; isOpen: boolean; ... }
export interface CatalogButtonProps { isOpen: boolean; onClick?: () => void; }
export interface CategoryItemProps { category: CategoryWithChildren; ... }
// … seven interfaces, one file, for a widget five folders deep
```

```tsx
// widgets/header/ui/header-panel/header-catalog/HeaderCatalog.tsx
import type { HeaderCatalogProps } from '../../../lib/types';
```

This is the reference project's rule (`panel-administration/userdata`), adopted
deliberately. An earlier version of this skill said the opposite (inline
`interface <Component>Props`) — that was wrong and has been corrected; code outside the
exception below still written that way predates the decision (see Known
inconsistencies).

**Exception: Next.js route files keep their props inline.** `page.tsx`, `error.tsx`,
`not-found.tsx`, `layout.tsx` declare their props interface right above the component, in
the same file:

```tsx
// app/catalog/[slug]/page.tsx
interface CatalogPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ params, searchParams }: CatalogPageProps) { ... }
```

```tsx
// app/error.tsx
interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}
```

Not an oversight — the reference project does the same in all 28 of its `page.tsx`
files: the props shape is dictated by the framework (`params`/`searchParams`/`error`/
`reset`), not by the slice's domain, so extracting it buys nothing. An earlier attempt to
move route props into a shared `app/types.ts` was reverted for exactly this reason —
verified by diffing back to byte-identical with the pre-change state.

## Barrel (`index.ts`)

Not every slice has one — only `entities/product` and `entities/category` do so far;
`features/` and `widgets/` slices are consumed directly by the `app/` files that use them.

What's re-exported: the query key builder, types, and the client hook — what a consumer
needs without knowing the slice's internal file layout:

```ts
// entities/product/index.ts
export * from './lib/queryKey';
export * from './lib/types';
export * from './api/hook';

// api/prefetch НЕ реэкспортируем: он тянет tsr.initQueryClient → серверный
// код, который в клиентском бандле ломается не на сборке, а в рантайме.
// Серверные компоненты импортируют prefetchProductList напрямую из
// './api/prefetch' — тот же приём, что и у entities/category/index.ts.
```

**`api/prefetch.ts` is never re-exported.** Server components that need it
(`app/catalog/[slug]/page.tsx`, `app/layout.tsx`) import it directly from
`./api/prefetch`, bypassing the barrel — confirmed in the code: nothing today imports
the bare `@/entities/product` or `@/entities/category` path at all, only the direct
file paths. Put a server-only file behind a barrel a client component also imports, and
it rides along into the client bundle even though nothing calls it.

## Naming (unchanged)

- Folders: kebab-case (`product-grid`, `catalog-admin`, `header-catalog`)
- Component file: PascalCase, one component per file (`ProductCard.tsx`, `CategoryForm.tsx`)
- Style file: same base name + `.module.scss`, colocated (`ProductCard.tsx` +
  `ProductCard.module.scss`)
- Sub-components nest under `ui/<sub-component-kebab>/`, recursively at any depth
  (`header-catalog/ui/CatalogButton/CatalogButton.tsx` is two levels deep inside
  `header-panel/header-catalog/`)

## Exports (unchanged)

- Components → arrow-function `const`, exported on a separate line at the bottom:
  `const ProductCard = (props) => {...}; export default ProductCard;`. Not
  `export default function Name() {}` and not inline `export default (props) => {...}`
- Hooks (`useX`) and icons (`shared/ui/icons/`) → named export, never default
- Barrel → named re-export only (`export * from './lib/types'`), never a default

## Client vs server components (unchanged)

`"use client"` as the very first line — only when the component uses state, effects,
browser APIs, or router hooks (`useSearchParams`, `usePathname`). Omit it for
presentational components with no hooks (`Footer.tsx`, `SocialIcon.tsx`).

## Imports (unchanged)

- Cross-layer imports (`widgets` → `entities`/`shared`) use the `@/` alias →
  `src/` (`@/entities/product/lib/formatPrice`)
- Imports within the same slice's subtree use relative paths (`../../../lib/types`,
  `./ui/CatalogButton/CatalogButton`)

## Icons (unchanged)

Each icon is its own component: `shared/ui/icons/<name>/<Name>.tsx`, named export, typed
with `SvgIconProps` (`size` + spread SVG props), `fill="currentColor"` so color is
controlled via CSS.

## Known inconsistencies — not yet standardized

- **CSS module class naming** is mixed: camelCase in `Footer.module.scss` (`listItem`,
  `contactBlock`) vs snake_case in `HeaderCatalog.module.scss`/`CatalogButton.module.scss`
  (`search_wrapper`, `catalog_button`). `stylelint`'s `selector-class-pattern` is
  disabled, so nothing enforces either — inherited legacy code, deliberately not
  restyled (its rendered markup can't be checked by eye in this environment). Don't
  assume one — ask when it matters.
- **`features/product-filter/`** and **`entities/product/model/types.ts`** /
  `api/products.api.ts` / `lib/buildFilterQueryParams.ts` / `lib/buildCategoryPath.ts` /
  `lib/labels.ts` are **parked, disconnected code** — the filter panel built against the
  retired `json-server` fixture, not the real API (nothing else in the app imports
  `products.api.ts`). It still uses pre-rewrite conventions (inline `interface Props`,
  a `model/` folder) because nobody has touched it since the type-location rule changed.
  Don't copy its shape into new code — see
  `.claude/docs/superpowers/specs/2026-08-28-product-filter-migration-design.md` for the
  migration plan that will bring it in line.

## Quick checklist for a new component

1. Pick the layer: `entities` (read by more than one feature/widget) vs `features` (a
   user action) vs `widgets` (a composite page section) vs `shared` (no domain)
2. Create `<kebab-folder>/<PascalName>.tsx` + `<PascalName>.module.scss`
3. Add the props interface to the slice's `lib/types.ts` — not inline — unless this is a
   route file (`page.tsx`/`error.tsx`/`not-found.tsx`/`layout.tsx`)
4. `export default` the component; add `"use client"` only if it needs hooks/browser APIs
5. Import shared code via `@/`, sibling code via relative path
