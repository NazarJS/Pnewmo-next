---
name: component-structure
description: Use when creating or restructuring React/Next.js components in this project — deciding where a file goes, how to name folders/files, which export style to use, or how to colocate styles
---

# Component Structure

## Overview

Project uses a Feature-Sliced Design-style layout under `src/`: `app/`, `shared/`, `widgets/` (more layers like `features/`/`entities/` may appear as the project grows). This skill captures the conventions actually used in the existing code so new components stay consistent.

## Layer placement

- `shared/ui/` — generic, reusable, no business logic (icons, inputs, buttons used anywhere)
- `widgets/<widget-name>/` — self-contained page sections (Header, Footer). Root holds `<Widget>.tsx` + `<Widget>.module.scss`
- Nested sub-components live in `widgets/<widget>/ui/<sub-component-kebab>/`. This pattern is recursive: a sub-component can itself get its own `ui/<sub-component-kebab>/` for its children, at any depth (e.g. `header-panel/header-catalog/ui/CatalogButton.tsx` is two levels deep; a child of `header-favorites` would follow the same pattern at `header-favorites/ui/<kebab>/<Name>.tsx`)
- Widget-local hooks go in a `hooks/` folder next to where they're used (`header-panel/hooks/useOpenInput.tsx`)

## Naming

- Folders: kebab-case (`header-nav`, `header-catalog`, `social-icons`)
- Component file: PascalCase, one component per file. Name matches the exported component, not necessarily the literal folder name (e.g. `header-nav/HeaderNavLayout.tsx`)
- Style file: same base name + `.module.scss`, colocated in the same folder (`HeaderCatalog.tsx` + `HeaderCatalog.module.scss`)

## Exports

- Components → arrow-function `const`, exported on a separate line at the bottom: `const HeaderCatalog = (props) => {...}; export default HeaderCatalog;`. Not `export default function Name() {}` and not inline `export default (props) => {...}`
- Icons (`shared/ui/icons/`) and hooks (`useX`) → named export, never default

## Props

- Inline `interface <Component>Props` directly above the component, in the same file
- Destructure in the function signature, defaults inline: `{ showSearch = true, isOpen, onClick }: HeaderCatalogProps`

## Client vs server components

- `"use client"` as the very first line — only when the component uses state/effects/browser APIs (`HeaderCatalog.tsx`, `CatalogButton.tsx`)
- Omit it for presentational components with no hooks (`Footer.tsx`, `SocialIcon.tsx`)

## Imports

- Cross-layer imports (widget → shared) use the `@/` alias → `src/` (`@/shared/ui/icons/arrow/Arrow`)
- Imports within the same widget subtree use relative paths (`../header-input/HeaderInput`, `./ui/footer-bottom/FooterBottom`)

## Icons

Each icon is its own component: `shared/ui/icons/<name>/<Name>.tsx`, named export, typed with `SvgIconProps` (`size` + spread SVG props), `fill="currentColor"` so color is controlled via CSS.

## Known inconsistency — not yet standardized

CSS module class naming is currently mixed in the codebase: camelCase in `Footer.module.scss` (`listItem`, `contactBlock`) vs snake_case in `HeaderCatalog.module.scss` / `CatalogButton.module.scss` (`search_wrapper`, `catalog_button`). `stylelint`'s `selector-class-pattern` is disabled, so nothing enforces either. Don't assume one — ask when it matters.

## Quick checklist for a new component

1. Pick layer: `shared` (generic, no business logic) vs `widgets` (page-section-specific)
2. Create `<kebab-folder>/<PascalName>.tsx` + `<PascalName>.module.scss`
3. Add `interface <PascalName>Props` above the component if it takes props
4. `export default` the component; add `"use client"` only if it needs hooks/browser APIs
5. Import shared code via `@/`, sibling code via relative path
