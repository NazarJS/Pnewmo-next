# Pnewmo

Каталог промышленного оборудования: гидравлика, пневматика, вакуумная техника.

Монорепо: Next.js фронтенд, NestJS API, общий контракт на ts-rest, Postgres в Docker.

## Требования

- Node 24 — `nvm use` подхватит из `.nvmrc`
- pnpm 10 — `npm i -g pnpm@10`
- Docker с запущенным демоном

## Запуск

```bash
nvm use
pnpm bootstrap
pnpm dev
```

- http://localhost:3000 — фронтенд
- http://localhost:3000/dev — служебная страница, показывает статус API
- http://localhost:4000/health — API
- http://localhost:3001 — mock-данные (json-server, до перехода на реальный API)

## Структура

```
apps/web               Next.js: фронтенд и служебный роут /dev
apps/api               NestJS: HTTP API
packages/api-contract  ts-rest + Zod: общий контракт для web и api
docs/superpowers       спеки и планы
```

Контракт — единственный источник правды об API. Zod-схема в `packages/api-contract`
одновременно валидирует входящие запросы на сервере и типизирует клиент на фронтенде.
Поэтому опечатка в имени поля ломает `pnpm typecheck`, а не проявляется в рантайме.

## Команды

| Команда | Что делает |
|---|---|
| `pnpm bootstrap` | создаёт `.env` из примеров, ставит зависимости |
| `pnpm dev` | Postgres + web + api + mock |
| `pnpm build` | сборка всех пакетов |
| `pnpm lint` | eslint и stylelint |
| `pnpm typecheck` | проверка типов |
| `pnpm test` | юнит-тесты |
| `pnpm format` | prettier по всему репозиторию |
| `pnpm db:up` / `pnpm db:down` | поднять / остановить Postgres, данные сохраняются |
| `pnpm db:reset` | снести данные и поднять базу заново |
| `pnpm db:psql` | psql-шелл в контейнере |
| `pnpm db:migrate` | создать миграцию по изменению `schema.prisma` |
| `pnpm db:generate` | перегенерировать клиент Prisma |
| `pnpm db:seed` | залить категории из фикстуры |
| `pnpm db:studio` | Prisma Studio, GUI по базе |
| `pnpm db:test:setup` | создать базу `pnewmo_test` и накатить на неё миграции |

E2E-тесты API: `pnpm --filter @pnewmo/api test:e2e`. Они работают против отдельной базы
`pnewmo_test` — сначала выполните `pnpm db:test:setup`.

**Правя контракт, запускайте `pnpm dev`, а не `pnpm --filter @pnewmo/api dev`.**
`packages/api-contract` компилируемый, и его watch (`tsc --watch`) поднимает только
turbo в составе `pnpm dev`. При запуске одного лишь `api` изменения в контракте не
подхватятся, и вы будете отлаживать поведение старой сборки.

`pnpm lint` в пакете `web` — это `eslint && stylelint`, поэтому пока eslint падает на
baseline, до stylelint дело не доходит. Запускать линтеры по отдельности:
`pnpm --filter @pnewmo/web lint:js` и `lint:css`.

Аргументы в `db:psql` передаются **без** `--`: `pnpm db:psql -tAc 'select 1'`.
Форма с `--` не работает — pnpm пробрасывает сам разделитель, и psql считает его
лишним позиционным аргументом.

## Переменные окружения

Три файла, по одному на область ответственности. Все три создаёт `pnpm bootstrap`,
реальные значения в `.gitignore`.

| Файл | Что задаёт | Кто читает |
|---|---|---|
| `.env` | `POSTGRES_*` | docker-compose |
| `apps/api/.env` | `DATABASE_URL`, `PORT`, `WEB_ORIGIN` | NestJS |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` | Next |

## Известные особенности окружения

**Postgres на порту 5433, не 5432.** На машине, где проект настраивался, 5432 занят
локальным PostgreSQL из Homebrew. Порт вынесен в `POSTGRES_PORT` в корневом `.env` —
если у вас 5432 свободен, поменяйте одну строку.

**Corepack не работает на этой конфигурации.** Под Node 20 закешированный pnpm 11
падает с `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`, под Node 23 — `Cannot find matching
keyid` из-за устаревших ключей подписи реестра. Ставьте pnpm через `npm i -g pnpm@10`.
Если corepack всё же нужен: `COREPACK_INTEGRITY_KEYS=0 corepack prepare pnpm@10.20.0 --activate`.

**Node 20 не поддерживается** — EOL с 30 апреля 2026, security-патчей нет.

**Zod пинится на 3.x.** ts-rest 3.52.1 требует `zod ^3.22.3`; поддержка Zod 4 есть
только в нестабильной `3.53.0-rc`. **TypeScript пинится на 5.x** — в реестре уже
`typescript@7`, но Next 16 и Nest 11 собраны против 5.x.

**`pnpm lint` завершается с кодом 1.** Это известный долг, а не поломка: линтеры
падали на существующем коде фронтенда до перестройки в монорепо. Зафиксированный
baseline — 2 ошибки eslint и 21 stylelint, полный список в
`docs/superpowers/specs/2026-08-11-monorepo-infra-design.md`, раздел «Baseline
линтеров». Любая ошибка сверх этого списка — новая, её надо исправлять.

## Схема базы данных

Prisma 7, PostgreSQL 16. Пока одна таблица — `categories`: дерево через `parent_id`
(adjacency list) с `ON DELETE RESTRICT`, уникальным `slug` и вложенностью до 5 уровней
в сидах. Схема — `apps/api/prisma/schema.prisma`.

Товары и заказы — следующие этапы, см. `docs/superpowers/specs/`.

Важное про Prisma 7: генератор называется `prisma-client` (не `prisma-client-js`),
`output` обязателен, а рантайм требует драйвер-адаптера — `new PrismaClient({ adapter })`
вокруг `pg.Pool`. Примеры для шестой версии не подойдут. Клиент генерируется в
`apps/api/src/generated/prisma` и в git не попадает: после `pnpm install` на новой машине
выполните `pnpm db:generate`.
