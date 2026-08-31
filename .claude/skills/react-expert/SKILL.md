---
name: react-expert
description: Use when writing or reviewing frontend code in apps/web or packages/ui — adding a component, page, hook or query, deciding whether something is a Server or Client Component, styling with Tailwind/SCSS, or writing tests for any of the above. Also for questions about Next.js App Router, React 19, TanStack Query or Tailwind v4 layering in this project.
---

# React/Next.js в этом проекте

Фронтенд `apps/web` построен на Next.js App Router: страница и Server Component
получают данные, Client Component отвечает за интерактивность, хук инкапсулирует
состояние и запросы. Presentational-компонент не знает, откуда пришли данные.

## Порядок чтения

| Файл | Когда |
|---|---|
| `references/principles.md` | любая задача по фронтенду: где чему место и почему |
| `references/patterns.md` | создание компонента/страницы, рефакторинг, код-ревью |
| скилл `component-structure` | новый компонент/слайс — раскладка файлов, именование, где лежат типы, барели |
| `.claude/context/frontend-data-layer.md` | работа с запросом/мутацией/SSR-префетчем — ключи запросов, кеш, ошибки API |

Для любой задачи достаточно `principles.md`. При создании нового компонента или ревью
добавляется `patterns.md` и `component-structure`. Слой данных (TanStack Query, ts-rest,
серверный префетч, кеш, классификация ошибок) описан отдельно в
`.claude/context/frontend-data-layer.md` — тем же приёмом, каким `nestjs-expert`
выносит конкретные шаблоны в `backend-style-guide.md`.

## Главное в одном абзаце

`"use client"` ставится только там, где реально нужны хуки состояния, эффекты или
браузерные API — по умолчанию компонент серверный. Данные с сервера читает
Server Component или `useQuery`, а не `useEffect` + `fetch`. Презентационный компонент
принимает пропсы и не знает про TanStack Query. Токены дизайна живут в `@theme`,
а не разбросаны по `w-[123px]`. Тип пропсов явный, `any` не используется.

**Экспорт зависит от типа файла, не от слоя.** Компонент (`.tsx`) — `export default`
снизу файла, конвенция зафиксирована в скилле `component-structure` и действует
одинаково в `widgets/`, `shared/`, `entities/`, `features/`. Хук (`useXxx`) — всегда
именованный экспорт, как в `entities/category/api/hook.ts` (`useCategories`). Не смешивать
это с делением по слоям — деления тут нет, только компонент vs хук.

## Tailwind CSS 4, а не 3

Самая частая ошибка: применить рецепт из интернета для третьей версии. В v4 нет
`tailwind.config.js` по умолчанию — конфигурация в CSS через `@theme`. Директива
`@tailwind base/components/utilities` заменена одной строкой `@import "tailwindcss"`.
Прежде чем предлагать «добавь в tailwind.config.js», проверь, что в проекте
действительно есть JS-конфиг, а не CSS-first подход. Подробности — в разделе
«Токены дизайна» `patterns.md`.

## React 19, а не 18

Формы и экшены — через `useActionState`/`useFormStatus`, а не самодельный
`useState` + `onSubmit` + `preventDefault` там, где нужен серверный экшен. Ref как
проп передаётся напрямую, `forwardRef` для новых компонентов не нужен. Прежде чем
предлагать паттерн из старой статьи про React, проверь, что он не устарел в 19.
