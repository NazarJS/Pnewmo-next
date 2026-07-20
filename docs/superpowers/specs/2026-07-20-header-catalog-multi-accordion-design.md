# HeaderCatalog: multi-expand mobile accordion + scroll containment

## Context

`src/widgets/header/ui/header-panel/header-catalog/HeaderCatalog.tsx` renders the catalog dropdown for both the desktop button trigger (`.container_catalog` wrapper) and the mobile burger trigger (`.mobile_catalog` wrapper) via the same component, differentiated by CSS breakpoints (unified on `$breakpoint-md: 1024px` in `src/shared/styles/_breakpoints.scss`).

Two behaviors need to change:

1. **Mobile accordion (`≤1024px`):** clicking a category currently closes whichever category was previously open (single-select), because open/closed state is tracked with one `catalogActive: string | null` value shared with the desktop mega-menu. Categories should be independently toggleable — opening one must not close another.
2. **Scroll containment while the catalog is open:** the page must not scroll (already handled, see below), and the catalog panel itself must scroll vertically when its content is taller than the viewport.

## Current state (verified in code, not assumed)

- `catalogActive: string | null` is the only piece of open/expanded state. It drives three things at once: the desktop `mega_menu` content (`data.find(cat => cat.id === catalogActive)`), the blue "active" highlight on both desktop and mobile, and the mobile `.mobile_accordion` expand/collapse.
- `toggleCategory(id)` (mobile click handler, gated `window.innerWidth <= 1024`) does `prev === id ? null : id` — a classic single-open accordion.
- Desktop hover (`onMouseEnter`, gated `window.innerWidth > 1024`) also writes to `catalogActive` — this is intentionally single-select (a mega-menu panel can only show one category's content at a time) and is **out of scope** for this change (confirmed with user).
- Page-scroll lock: a `useEffect` toggles a `no-scroll` class on `document.body` based on the `isOpen` prop, unconditional on viewport width. This already works correctly and is **not being touched**.
- Catalog-panel internal scroll: `.catalog_container`'s `@include xs { height: calc(100vh - 50px); overflow-y: auto; ... }` in `HeaderCatalog.module.scss`. Since `@include xs` now resolves to `≤1024px` (global breakpoint bump the user already made), this already applies across the full mobile/tablet range where the accordion is used. **No CSS change is needed** — taller content from multiple simultaneously-open categories will scroll inside the existing container instead of overflowing the page.
- The `768` → `1024` breakpoint unification in TSX (`toggleCategory` guard, the mount effect that pre-selects `data[0]` for desktop, and the `onMouseEnter` guard) has already been applied by the user. No further breakpoint work remains.

## Design

### State

Split the single `catalogActive` into two independent pieces of state:

- `catalogActive: string | null` — **unchanged**, still desktop-only (hover-driven), still drives `mega_menu`.
- `openCategories: Set<string>` — **new**, mobile-only, tracks which categories are expanded in the accordion. Starts empty (`new Set()`), matching today's "nothing expanded by default" behavior.

### Behavior changes

- `toggleCategory(id)` mutates `openCategories` (add if absent, remove if present) instead of replacing `catalogActive`:
  ```ts
  const toggleCategory = (id: string) => {
    if (window.innerWidth <= 1024) {
      setOpenCategories((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
  };
  ```
- The per-item `isActive` flag becomes the union of both states:
  ```ts
  const isActive = catalogActive === cat.id || openCategories.has(cat.id);
  ```
  This is safe to reuse as a single flag for both the `li` className and `.mobile_accordion`'s `accordion_open` class, because the CSS that reads it is already breakpoint-disjoint: the desktop blue-highlight rule is gated `@media (width >= 1025px)` and the mobile accordion/expand rules are gated `@include xs` (`≤1024px`). At any given viewport width, only one half of `isActive`'s two sources can realistically be true, so no JSX/CSS restructuring is required beyond the state split itself.
- No change to `onMouseEnter`, the mount effect, the page-scroll-lock effect, or any CSS.

### Data flow

```
click on category (≤1024px)
  → toggleCategory(id)
  → openCategories: Set<string> (add/remove id)
  → isActive = catalogActive === id || openCategories.has(id)
  → li className + .mobile_accordion className re-evaluated
  → CSS (@include xs, unaffected by this change) handles expand animation + panel-level scroll
```

Desktop hover path is unchanged: `onMouseEnter → setCatalogActive(id) → activeCategoryData → mega_menu`.

### Testing / verification

No test framework is configured in this project (no test runner in `package.json`). Verification will be manual, in-browser, per the project's `run`/`verify` conventions:

1. Mobile/tablet width (≤1024px): open catalog, expand category A, expand category B without A collapsing, collapse A independently — confirms multi-expand.
2. Expand enough categories simultaneously that total content exceeds viewport height — confirm the catalog panel scrolls internally and the page behind it does not scroll (body `no-scroll` class present in devtools while open).
3. Desktop width (≥1025px): confirm hover behavior on `mega_menu` is unchanged (single active category, switching on hover).
4. Resize across the 1024px boundary while catalog is open — no crash, no stuck state (not a new requirement, just a regression check since the breakpoint logic is touched by proximity).

### Out of scope (explicitly confirmed with user)

- Desktop `mega_menu` remains single-select/hover-driven.
- No further breakpoint unification beyond what's already done (639–1024px tablet-range visual layout of `.sidebar`/`mega_menu` is a pre-existing concern, not addressed here).
