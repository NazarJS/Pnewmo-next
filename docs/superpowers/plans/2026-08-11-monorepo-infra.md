# Этап 1: монорепо и локальная инфраструктура — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить одиночный Next.js-проект в монорепо на Turborepo с рабочим NestJS-бэкендом и Postgres в Docker, так чтобы участник команды на чистой машине выполнил три команды и получил работающее окружение.

**Architecture:** pnpm workspace с `apps/web` (существующий Next), `apps/api` (новый NestJS) и `packages/api-contract` (ts-rest + Zod, общий контракт). Postgres поднимается в Docker, приложения — на хосте. Turborepo оркеструет задачи и порядок сборки: пакет-контракт собирается раньше приложений через `dependsOn: ["^build"]`.

**Tech Stack:** Node 24, pnpm 10.20.0, Turborepo 2.10.9, Next 16.2.6, NestJS 11.1.29, ts-rest 3.52.1, Zod 3.25.76, TypeScript 5.9.3, PostgreSQL 16, Docker Compose v2.

**Спек:** `docs/superpowers/specs/2026-08-11-monorepo-infra-design.md`

**Исходное состояние:** ветка `dev` уже создана от `main` и содержит один коммит — спек (`c97d864`). Пункт 1 объёма спека закрыт до начала плана, отдельной задачи на него нет.

## Global Constraints

- **Node 24.** `.nvmrc` содержит `24`, `engines.node` — `">=24"`. Node 20 в EOL с 30 апреля 2026. Проверено: `next@16.2.6` требует `>=20.9.0`, `@nestjs/core@11.1.29` — `>= 20`, `@nestjs/cli@11.0.24` — `>= 20.11`. Node 24.19.0 (LTS «Krypton», вышел 2026-08-03) удовлетворяет всем.
- **Zod пинится на 3.25.76, не 4.x.** Последняя стабильная ts-rest 3.52.1 объявляет `peerDependencies: { zod: "^3.22.3" }`. Поддержка Zod 4 существует только в `3.53.0-rc.1`, стабильного релиза нет. Версии Zod указываются точно, без `^`.
- **TypeScript пинится на `^5.9.3`, не на latest.** В реестре latest — `typescript@7.0.2` (переписанный на Go компилятор). Next 16 и Nest 11 собраны против TS 5.x. Диапазон `^5` не подтянет 6.x и 7.x.
- **Точные версии без caret** для `@ts-rest/core`, `@ts-rest/nest`, `zod`, `turbo` — это версионно-чувствительные зависимости, где `^` уже дал бы несовместимость.
- **Имя скрипта `bootstrap`, не `setup`** — `pnpm setup` перехватывается встроенной командой pnpm.
- **Коммит переезда содержит только переименования.** Никаких правок содержимого файлов в том же коммите: при 100% similarity index git детектит переименования, и будущий `git merge` правок из репозитория NazarJS сам разложит их по новым путям.
- **Push не выполняется ни в одной задаче.** `origin` в этом клоне указывает на `https://github.com/NazarJS/Pnewmo-next.git` — репозиторий тимлида. Все коммиты остаются локальными в ветке `dev`.
- **Порты:** web 3000, json-server 3001, api 4000, Postgres 5432.

## Замечание о тестах

Большая часть задач — инфраструктура: `docker-compose.yml`, `turbo.json`, скрипты. Юнит-тесты на них не пишутся, поэтому цикл в этих задачах — «команда → ожидаемый вывод», и ожидаемый вывод указан буквально. Настоящий автоматический тест есть в Task 5 (e2e на `GET /health` через Jest + supertest) — там он уместен, потому что проверяет код, а не конфигурацию.

## File Structure

| Файл | Ответственность |
|---|---|
| `.nvmrc` | версия Node для nvm |
| `package.json` (корень) | скрипты-оркестраторы, `packageManager`, `engines`. Не содержит зависимостей приложений |
| `pnpm-workspace.yaml` | список пакетов workspace + разрешения на сборку нативных зависимостей |
| `turbo.json` | граф задач: `build`, `dev`, `mock`, `lint`, `typecheck` |
| `tsconfig.base.json` | только общие strict-флаги. Модульную систему каждый пакет задаёт сам |
| `prettier.config.mjs` | форматирование, общее на весь репозиторий |
| `docker-compose.yml` | Postgres 16 с healthcheck и named volume |
| `.env.example` | переменные для docker-compose |
| `scripts/bootstrap.mjs` | идемпотентное копирование трёх `.env.example` в реальные файлы |
| `packages/api-contract/src/health.contract.ts` | Zod-схема ответа и ts-rest-роут `/health` |
| `packages/api-contract/src/index.ts` | сборка роутеров в единый `contract` |
| `apps/api/src/main.ts` | точка входа: CORS, порт. Валидацию делает Zod через контракт, не `ValidationPipe` |
| `apps/api/src/app.module.ts` | корневой модуль |
| `apps/api/src/health/health.controller.ts` | обработчик `/health` через `tsRestHandler` |
| `apps/api/test/health.e2e-spec.ts` | e2e-тест на `/health` |
| `apps/web/src/shared/api/client.ts` | ts-rest-клиент, `baseUrl` из `NEXT_PUBLIC_API_URL` |
| `apps/web/src/app/dev/page.tsx` | служебный роут: показывает статус API |
| `README.md` | онбординг в три команды |

---

### Task 1: Node 24 и pnpm — зафиксировать окружение

Регрессионная проверка **до** любой перестройки: если текущий фронтенд на Node 24 не заводится, узнаём это на чистом дереве, а не посреди переезда.

**Files:**
- Create: `.nvmrc`

**Interfaces:**
- Produces: рабочий Node 24 + pnpm 10.20.0 в PATH. Все последующие задачи предполагают, что `nvm use` уже сделан.

- [ ] **Step 1: Установить Node 24 и pnpm**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm install 24
nvm use 24
node -v
npm i -g pnpm@10.20.0
pnpm -v
```

Expected: `node -v` → `v24.19.x`, `pnpm -v` → `10.20.0`.

Про corepack: у Node 20 в `~/.nvm/versions/node/v20.19.5/bin/pnpm` лежит сломанный шим corepack. У Node 24 отдельная bin-директория, конфликта нет — `npm i -g` установит pnpm чисто.

- [ ] **Step 2: Переустановить зависимости под новый ABI**

```bash
rm -rf node_modules
pnpm install
```

Expected: в выводе видно `sharp install: Done`, `@parcel/watcher install: Done`, `unrs-resolver postinstall: Done`.

Нативные модули (`sharp`, `@parcel/watcher`) скомпилированы под ABI Node 20 и на Node 24 упадут. Переустановка обязательна, простого `pnpm install` без удаления `node_modules` недостаточно.

- [ ] **Step 3: Создать `.nvmrc`**

```
24
```

- [ ] **Step 4: Проверить, что фронтенд работает на Node 24**

```bash
./node_modules/.bin/json-server db.json --port 3001 &
MOCK_PID=$!
./node_modules/.bin/next dev --port 3000 &
NEXT_PID=$!
sleep 12
for u in / /catalog/gidravlika /product/1; do printf "%s -> " "$u"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$u"; done
kill $MOCK_PID $NEXT_PID
```

Expected: три строки `200`.

Если любая отдаёт 500 — Node 24 несовместим, останавливаемся и откатываемся на Node 22 (`nvm install 22`, `.nvmrc` → `22`), затем повторяем шаг. На Node 20 не остаёмся ни в каком случае.

- [ ] **Step 5: Коммит**

```bash
git add .nvmrc
git commit -m "chore: pin Node 24 via .nvmrc

Node 20 reached EOL on 2026-04-30. Verified the existing Next app
builds and serves all routes on Node 24.19."
```

---

### Task 2: Переезд в `apps/web` и корневой workspace

Две части в одной задаче, потому что между ними репозиторий в нерабочем состоянии — корневой `package.json` уехал, новый ещё не создан. Коммита внутри задачи два, и первый обязан содержать только переименования.

**Files:**
- Move: 11 отслеживаемых объектов из корня в `apps/web/`
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `prettier.config.mjs`, `scripts/bootstrap.mjs`
- Modify: `.gitignore`, `apps/web/package.json`, `apps/web/tsconfig.json`
- Delete: `package-lock.json`, отслеживаемые `.DS_Store` (8 файлов), отслеживаемый `next-env.d.ts`

**Interfaces:**
- Consumes: Node 24 и pnpm из Task 1.
- Produces: `pnpm dev` из корня поднимает web:3000 и json-server:3001. Пакет `@pnewmo/web` доступен в workspace. Turbo-задачи `dev`, `mock`, `build`, `lint`, `typecheck`.

- [ ] **Step 1: Переместить всё в `apps/web` только через `git mv`**

```bash
mkdir -p apps/web
git mv src public db.json next.config.ts next-env.d.ts eslint.config.mjs \
       .stylelintrc.json postcss.config.mjs tsconfig.json package.json \
       reedme.txt apps/web/
rm -rf .next
```

Список выверен по `git ls-files`. В корне сознательно остаются: `docs/`, `.claude/`, `.vscode/`, `AGENTS.md`, `README.md`, `.gitignore`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.

- [ ] **Step 2: Проверить, что git видит переименования, а не удаления**

Run: `git status --short`

Expected: все строки начинаются с `R` (renamed). Ни одной пары `D`+`??`.

Если появились `D` — переименование не отследилось, надо откатить (`git reset --hard`) и повторить шаг 1.

- [ ] **Step 3: Коммит только переименований**

```bash
git commit -m "refactor: move the Next app into apps/web

Pure rename commit, no content changes, so git records a 100%
similarity index. This keeps rename detection working for future
merges of upstream changes into the new paths."
```

- [ ] **Step 4: Проверить, что история файлов прослеживается через переезд**

Run: `git log --oneline --follow apps/web/src/widgets/header/Header.tsx | tail -3`

Expected: видны коммиты, сделанные до переезда (не только последний).

- [ ] **Step 5: Создать корневой `package.json`**

```json
{
  "name": "pnewmo",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@10.20.0",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "bootstrap": "node scripts/bootstrap.mjs && pnpm install",
    "dev": "pnpm db:up && turbo run dev mock",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "prettier --write .",
    "db:up": "docker compose up -d --wait postgres",
    "db:down": "docker compose stop postgres",
    "db:reset": "docker compose down -v && pnpm db:up",
    "db:psql": "docker compose exec postgres psql -U pnewmo -d pnewmo"
  },
  "devDependencies": {
    "prettier": "3.8.3",
    "turbo": "2.10.9",
    "typescript": "^5.9.3"
  }
}
```

`db:psql` — интерактивный шелл для человека, поэтому имя пользователя и базы записаны буквально. Подставить их из `.env` не получается: хост-шелл этих переменных не видит, а обёртка в `sh -c` внутри контейнера ломает передачу дополнительных аргументов вида `pnpm db:psql -- -c '...'`. Значения совпадают с `.env.example` из Task 3; при смене `POSTGRES_USER` или `POSTGRES_DB` в `.env` этот скрипт надо поправить.

Для неинтерактивных проверок в шагах ниже используется прямой вызов с флагом `-T`: без него `docker compose exec` требует TTY и падает с `the input device is not a TTY`.

- [ ] **Step 6: Создать `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"

onlyBuiltDependencies:
  - "@parcel/watcher"
  - sharp
  - unrs-resolver
```

Заменяет прежнее содержимое (там был ключ `allowBuilds` с тем же списком). Дубликат из `apps/web/package.json` удаляется в шаге 9.

- [ ] **Step 7: Создать `turbo.json`**

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "mock": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

`dependsOn: ["^build"]` у `dev` и `typecheck` — это то, что заставляет `packages/api-contract` собраться раньше, чем приложения попытаются его импортировать. `mock` не зависит ни от чего: json-server читает `db.json` напрямую.

- [ ] **Step 8: Создать `tsconfig.base.json` и `prettier.config.mjs`**

`tsconfig.base.json` — умышленно только strict-флаги. Модульную систему, `target` и `lib` каждый пакет задаёт свои: у Next это `esnext` + `bundler` + `dom`, у Nest — `CommonJS`, и общий базовый файл их бы стравил.

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`prettier.config.mjs`:

```js
/** @type {import("prettier").Config} */
const config = {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  semi: true,
};

export default config;
```

- [ ] **Step 9: Обновить `apps/web/package.json`**

Полное содержимое:

```json
{
  "name": "@pnewmo/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "mock": "json-server db.json --port 3001",
    "build": "next build",
    "start": "next start",
    "lint": "eslint && stylelint \"src/**/*.scss\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.6",
    "react-dom": "19.2.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "json-server": "^1.0.0-beta.15",
    "postcss-pxtorem": "^6.1.0",
    "sass": "^1.100.0",
    "stylelint": "^17.13.0",
    "stylelint-config-standard": "^40.0.0",
    "stylelint-config-standard-scss": "^17.0.0",
    "stylelint-order": "^8.1.1",
    "tailwindcss": "^4",
    "typescript": "^5.9.3"
  }
}
```

Три изменения к прежнему: имя стало `@pnewmo/web`; добавлены задачи `mock` и `typecheck`, а `lint` теперь запускает и stylelint (раньше конфиг stylelint лежал, но никем не вызывался); удалён блок `"pnpm": { "onlyBuiltDependencies": [...] }` — он переехал в `pnpm-workspace.yaml`. `prettier` убран из devDependencies: он теперь корневой.

- [ ] **Step 10: Подключить `apps/web/tsconfig.json` к базовому**

Добавить первой строкой `"extends": "../../tsconfig.base.json"` и удалить из `compilerOptions` продублированные `strict`, `esModuleInterop`, `skipLibCheck`.

Дополнительно: из массива `include` удалить `"src/widgets/header/Layout.jsx"` — такого файла в репозитории нет, запись висячая.

Результат:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 11: Обновить `.gitignore` и убрать мусор из индекса**

Полное содержимое `.gitignore`:

```
node_modules/
.next/
.turbo/
dist/
next-env.d.ts
.env
.env*.local
.DS_Store
*.tsbuildinfo
```

```bash
git rm --cached -q $(git ls-files | grep DS_Store)
git rm --cached -q apps/web/next-env.d.ts
rm -f package-lock.json
```

`next-env.d.ts` был закоммичен до того, как попал в `.gitignore` — правила игнорирования не действуют на уже отслеживаемые файлы. Next перегенерирует его при первом запуске. `package-lock.json` (311 КБ) удаляется: пакетный менеджер один, два лок-файла со временем расходятся.

- [ ] **Step 12: Создать `scripts/bootstrap.mjs`**

Файлы `.env.example`, на которые он ссылается, создаются в Task 3 и Task 5. Скрипт пропускает отсутствующие источники, поэтому работает и до их появления.

```js
import { copyFileSync, existsSync } from 'node:fs';

const pairs = [
  ['.env.example', '.env'],
  ['apps/api/.env.example', 'apps/api/.env'],
  ['apps/web/.env.example', 'apps/web/.env.local'],
];

let created = 0;

for (const [from, to] of pairs) {
  if (!existsSync(from)) {
    console.log(`skip   ${to} (no ${from})`);
    continue;
  }

  if (existsSync(to)) {
    console.log(`skip   ${to} (already exists)`);
    continue;
  }

  copyFileSync(from, to);
  console.log(`create ${to}`);
  created += 1;
}

console.log(created ? `\n${created} env file(s) created` : '\nnothing to create');
```

- [ ] **Step 13: Установить зависимости и проверить workspace**

```bash
rm -rf node_modules apps/web/node_modules
pnpm install
pnpm list -r --depth -1
```

Expected: в выводе `pnpm list` присутствуют `pnewmo` (корень) и `@pnewmo/web`. В выводе `pnpm install` — `sharp install: Done` (подтверждает, что `onlyBuiltDependencies` в `pnpm-workspace.yaml` подхватился).

- [ ] **Step 14: Проверить, что фронтенд работает из монорепо**

```bash
pnpm turbo run dev mock > /tmp/turbo-dev.log 2>&1 &
TURBO_PID=$!
sleep 15
for u in / /catalog/gidravlika /product/1; do printf "%s -> " "$u"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$u"; done
kill $TURBO_PID
```

Expected: три строки `200`. Запускается `turbo run dev mock` напрямую, а не `pnpm dev`, потому что `pnpm dev` дополнительно поднимает Postgres, которого до Task 3 ещё нет.

- [ ] **Step 15: Проверить lint, typecheck и build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Expected: все три зелёные.

- [ ] **Step 16: Коммит**

```bash
git add -A
git commit -m "feat: set up pnpm workspace and Turborepo at the repo root

Root package.json holds only orchestrator scripts; the Next app becomes
@pnewmo/web. Adds turbo.json, tsconfig.base.json, shared prettier and
the bootstrap script.

Cleanup: drop package-lock.json (pnpm is the only package manager),
untrack .DS_Store and the generated next-env.d.ts, consolidate the
native-build allowlist into pnpm-workspace.yaml, wire stylelint into
the web lint script and remove a dangling tsconfig include entry."
```

---

### Task 3: Postgres в Docker и команды `db:*`

**Files:**
- Create: `docker-compose.yml`, `.env.example`

**Interfaces:**
- Consumes: корневые скрипты `db:up` / `db:down` / `db:reset` / `db:psql` из Task 2.
- Produces: Postgres 16 на `localhost:5432`, база и пользователь `pnewmo`. Строка подключения — `postgresql://pnewmo:pnewmo_local_dev@localhost:5432/pnewmo`. Task 5 использует её в `apps/api/.env.example`.

- [ ] **Step 1: Создать `.env.example`**

```
POSTGRES_USER=pnewmo
POSTGRES_PASSWORD=pnewmo_local_dev
POSTGRES_DB=pnewmo
POSTGRES_PORT=5432
```

- [ ] **Step 2: Создать `docker-compose.yml`**

Ключа `version:` нет намеренно — в Compose v2 он объявлен устаревшим и вызывает предупреждение.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: pnewmo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - '${POSTGRES_PORT}:5432'
    volumes:
      - pnewmo-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pnewmo-pgdata:
```

Двойной `$$` в healthcheck обязателен: одинарный `$` Compose подставил бы сам при разборе файла, а нужно, чтобы переменную развернул shell внутри контейнера.

- [ ] **Step 3: Создать `.env` и поднять базу**

```bash
node scripts/bootstrap.mjs
pnpm db:up
```

Expected: `create .env`, затем `Container pnewmo-postgres  Healthy`. Флаг `--wait` в `db:up` держит команду до прохождения healthcheck, поэтому следующий шаг не наткнётся на неготовую базу.

- [ ] **Step 4: Проверить подключение**

```bash
docker compose exec -T postgres psql -U pnewmo -d pnewmo -c 'select version();'
```

Expected: строка с `PostgreSQL 16.`

- [ ] **Step 5: Проверить, что данные переживают перезапуск**

```bash
docker compose exec -T postgres psql -U pnewmo -d pnewmo \
  -c 'create table smoke(id int); insert into smoke values (42);'
pnpm db:down && pnpm db:up
docker compose exec -T postgres psql -U pnewmo -d pnewmo -c 'select id from smoke;'
```

Expected: последняя команда возвращает `42` — named volume сохранился.

- [ ] **Step 6: Проверить, что `db:reset` действительно сносит данные**

```bash
pnpm db:reset
docker compose exec -T postgres psql -U pnewmo -d pnewmo -c 'select id from smoke;'
```

Expected: ошибка `relation "smoke" does not exist`. Это успех: `db:reset` удалил volume вместе с таблицей.

- [ ] **Step 7: Проверить интерактивный шелл**

Run: `pnpm db:psql`
Expected: приглашение `pnewmo=#`. Выйти — `\q`.

- [ ] **Step 8: Коммит**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: run Postgres 16 in Docker with healthcheck and named volume

db:up waits for the healthcheck, db:down keeps the volume, db:reset
drops it. Verified data survives a stop/start cycle and is gone after
a reset."
```

---

### Task 4: `packages/api-contract` — общий контракт

**Files:**
- Create: `packages/api-contract/package.json`, `packages/api-contract/tsconfig.json`, `packages/api-contract/src/health.contract.ts`, `packages/api-contract/src/index.ts`

**Interfaces:**
- Produces: пакет `@pnewmo/api-contract`, экспортирующий `contract` с роутом `contract.health.check` (`GET /health`, ответ 200 — `{ status: 'ok', uptime: number }`), а также `healthSchema` и тип `Health`. Импортируется в Task 5 (Nest) и Task 6 (Next).

- [ ] **Step 1: Создать `packages/api-contract/package.json`**

```json
{
  "name": "@pnewmo/api-contract",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch --preserveWatchOutput",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@ts-rest/core": "3.52.1",
    "zod": "3.25.76"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

Задачи `typecheck` у пакета нет намеренно: `build` уже проверяет типы, а `tsc --noEmit` при `declaration: true` даёт конфликт опций в части версий TypeScript. Turbo просто пропускает пакеты без нужной задачи.

- [ ] **Step 2: Создать `packages/api-contract/tsconfig.json`**

`module: CommonJS` — потому что NestJS работает в CommonJS и должен уметь `require` этот пакет. Next потребляет CommonJS без проблем, обратное неверно.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "Node10",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Создать `packages/api-contract/src/health.contract.ts`**

```ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const healthSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
});

export type Health = z.infer<typeof healthSchema>;

export const healthContract = c.router({
  check: {
    method: 'GET',
    path: '/health',
    responses: {
      200: healthSchema,
    },
    summary: 'Liveness probe',
  },
});
```

- [ ] **Step 4: Создать `packages/api-contract/src/index.ts`**

```ts
import { initContract } from '@ts-rest/core';

import { healthContract } from './health.contract';

const c = initContract();

export const contract = c.router({
  health: healthContract,
});

export * from './health.contract';
```

- [ ] **Step 5: Установить и собрать**

```bash
pnpm install
pnpm --filter @pnewmo/api-contract build
```

Expected: команды проходят без ошибок, появляются `packages/api-contract/dist/index.js` и `dist/index.d.ts`.

- [ ] **Step 6: Проверить, что типы действительно выведены, а не `any`**

```bash
grep -rn '"ok"' packages/api-contract/dist/*.d.ts
```

Expected: хотя бы одно совпадение в `health.contract.d.ts` — `status: "ok"` как литеральный тип, а не `string`. Это подтверждает, что Zod-схема доехала до `.d.ts` и потребители получат честную типизацию, а не `any`.

- [ ] **Step 7: Коммит**

```bash
git add packages/api-contract
git commit -m "feat: add @pnewmo/api-contract with a ts-rest health route

Zod pinned to 3.25.76: ts-rest 3.52.1 declares a zod ^3.22.3 peer
dependency, and Zod 4 support exists only in the unreleased 3.53.0-rc.
Compiled to CommonJS so NestJS can require it."
```

---

### Task 5: `apps/api` — NestJS с `GET /health` по контракту

**Files:**
- Create: `apps/api/**` (скаффолд Nest CLI), `apps/api/.env.example`, `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.module.ts`, `apps/api/test/health.e2e-spec.ts`
- Modify: `apps/api/package.json` (в том числе удаление `class-validator` и `class-transformer` из скаффолда), `apps/api/tsconfig.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Delete: `apps/api/src/app.controller.ts`, `apps/api/src/app.service.ts`, `apps/api/src/app.controller.spec.ts`, `apps/api/test/app.e2e-spec.ts`, `apps/api/.prettierrc`

**Interfaces:**
- Consumes: `contract.health.check` из `@pnewmo/api-contract` (Task 4). Строку подключения к Postgres из Task 3.
- Produces: `GET http://localhost:4000/health` → `200 { status: 'ok', uptime: number }`. Задача turbo `dev` в пакете `@pnewmo/api`. Task 6 обращается к этому эндпоинту.

- [ ] **Step 1: Сгенерировать скаффолд**

```bash
cd apps
pnpm dlx @nestjs/cli@11.0.24 new api --skip-git --skip-install --package-manager pnpm --language TS
cd ..
```

`--skip-git` — иначе CLI создаст вложенный репозиторий. `--skip-install` — иначе появится вложенный `node_modules` и второй лок-файл в обход workspace.

- [ ] **Step 2: Удалить лишнее из скаффолда**

```bash
rm -f apps/api/src/app.controller.ts apps/api/src/app.service.ts \
      apps/api/src/app.controller.spec.ts apps/api/test/app.e2e-spec.ts \
      apps/api/.prettierrc
```

`.prettierrc` удаляется, потому что форматирование задаётся корневым `prettier.config.mjs`; два конфига дали бы разное форматирование в разных папках. Файлы `app.controller/service` — это демо «Hello World», нам оно ни к чему, а `test/jest-e2e.json` от скаффолда остаётся и используется.

- [ ] **Step 3: Заменить `apps/api/package.json`**

```json
{
  "name": "@pnewmo/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "jest --passWithNoTests",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  },
  "dependencies": {
    "@nestjs/common": "11.1.29",
    "@nestjs/core": "11.1.29",
    "@nestjs/platform-express": "11.1.29",
    "@pnewmo/api-contract": "workspace:*",
    "@ts-rest/core": "3.52.1",
    "@ts-rest/nest": "3.52.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "3.25.76"
  },
  "devDependencies": {
    "@nestjs/cli": "11.0.24",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "11.1.29",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^24.0.0",
    "@types/supertest": "^6.0.2",
    "eslint": "^9",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.9.3"
  }
}
```

Скаффолд называет задачу `start:dev`; turbo ищет `dev`, поэтому переименована. `@ts-rest/nest@3.52.1` объявляет совместимость с `@nestjs/core ^11` — проверено.

`class-validator` и `class-transformer` из скаффолда **удалены намеренно**, вместе с глобальным `ValidationPipe`. Они обслуживают DTO-классы с декораторами, а валидацию у нас выполняет Zod-схема контракта: `@ts-rest/nest` проверяет `body`, `pathParams`, `query` и `headers` и сам отдаёт 400. Держать две системы валидации — это тот самый пункт «нет преждевременных абстракций» из чеклиста стайлгайда. Обоснование целиком — в разделе спека «Валидация: только Zod через контракт».

Блок `jest` сохранён из скаффолда: он настраивает юнит-тесты (`*.spec.ts` внутри `src`). В этапе 1 таких тестов нет, поэтому в скрипт `test` добавлен `--passWithNoTests`, иначе jest завершался бы с ошибкой «no tests found». E2E-тесты используют отдельный конфиг `test/jest-e2e.json` из скаффолда — он ищет `*.e2e-spec.ts` и остаётся без изменений.

- [ ] **Step 4: Подключить `apps/api/tsconfig.json` к базовому**

`declaration: false` — иначе `typecheck` через `tsc --noEmit` конфликтует с генерацией `.d.ts`. Приложению объявления типов не нужны, они нужны библиотекам.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "strictBindCallApply": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 5: Создать `apps/api/.env.example`**

`DATABASE_URL` в этапе 1 ещё никем не читается — Prisma появится в этапе 3. Переменная задаётся сейчас, чтобы значение было согласовано с `docker-compose.yml` из Task 3 в одном месте.

```
DATABASE_URL=postgresql://pnewmo:pnewmo_local_dev@localhost:5432/pnewmo?schema=public
PORT=4000
WEB_ORIGIN=http://localhost:3000
```

- [ ] **Step 6: Написать падающий e2e-тест**

Create `apps/api/test/health.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports ok', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
  });

  it('reports uptime as a positive number', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.uptime).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7: Запустить тест и убедиться, что он падает**

```bash
pnpm install
pnpm --filter @pnewmo/api-contract build
pnpm --filter @pnewmo/api test:e2e
```

Expected: FAIL. Тесты получают 404 вместо 200 — контроллера `/health` ещё нет.

- [ ] **Step 8: Создать контроллер и модуль**

Create `apps/api/src/health/health.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { contract } from '@pnewmo/api-contract';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

@Controller()
export class HealthController {
  @TsRestHandler(contract.health.check)
  async check() {
    return tsRestHandler(contract.health.check, async () => ({
      status: 200 as const,
      body: {
        status: 'ok' as const,
        uptime: process.uptime(),
      },
    }));
  }
}
```

Create `apps/api/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 9: Переписать `app.module.ts` и `main.ts`**

`apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule],
})
export class AppModule {}
```

`apps/api/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });

  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
```

- [ ] **Step 10: Запустить тест и убедиться, что он проходит**

Run: `pnpm --filter @pnewmo/api test:e2e`
Expected: PASS, 2 теста.

- [ ] **Step 11: Проверить живой эндпоинт**

```bash
node scripts/bootstrap.mjs
pnpm --filter @pnewmo/api dev > /tmp/api-dev.log 2>&1 &
API_PID=$!
sleep 12
curl -s http://localhost:4000/health
kill $API_PID
```

Expected: JSON вида `{"status":"ok","uptime":8.1}`.

- [ ] **Step 12: Коммит**

```bash
git add apps/api
git commit -m "feat: add NestJS api app serving GET /health via the shared contract

Handler is wired through @ts-rest/nest, so the response shape is
enforced by the same Zod schema the frontend will consume. Covered by
an e2e test.

Scaffolded with Nest CLI, then trimmed: the Hello World controller and
service are removed, and .prettierrc is dropped in favour of the root
prettier config."
```

---

### Task 6: Роут `/dev` в `apps/web`, потребляющий контракт

Замыкает цепочку `web → api-contract → api` и делает связность монорепо видимой. Дальше эта страница — площадка для тестовых CRUD-компонентов.

**Files:**
- Create: `apps/web/.env.example`, `apps/web/src/shared/api/client.ts`, `apps/web/src/app/dev/page.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: `contract` из `@pnewmo/api-contract` (Task 4), эндпоинт `/health` из Task 5.
- Produces: `http://localhost:3000/dev` показывает статус API. Экспорт `api` из `@/shared/api/client` — типизированный клиент для последующих этапов.

- [ ] **Step 1: Создать `apps/web/.env.example`**

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

- [ ] **Step 2: Добавить зависимости в `apps/web/package.json`**

В блок `dependencies` добавить три строки:

```json
"@pnewmo/api-contract": "workspace:*",
"@ts-rest/core": "3.52.1",
"zod": "3.25.76"
```

- [ ] **Step 3: Создать ts-rest-клиент**

Create `apps/web/src/shared/api/client.ts`. Слой `shared` выбран по конвенции проекта из `.claude/skills/component-structure/SKILL.md`: клиент не содержит бизнес-логики и используется откуда угодно. Хуки и компоненты — именованный экспорт, тоже по конвенции.

```ts
import { contract } from '@pnewmo/api-contract';
import { initClient } from '@ts-rest/core';

export const api = initClient(contract, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  baseHeaders: {},
});
```

- [ ] **Step 4: Создать страницу `/dev`**

Create `apps/web/src/app/dev/page.tsx`. Стиль — стрелочная функция с `export default` внизу файла, по конвенции проекта. `force-dynamic` нужен, чтобы Next не закешировал ответ на этапе сборки: `uptime` меняется на каждом запросе.

```tsx
import { api } from '@/shared/api/client';

export const dynamic = 'force-dynamic';

const DevPage = async () => {
  const response = await api.health.check();

  return (
    <section>
      <h1>Dev</h1>

      {response.status === 200 ? (
        <p>
          API: {response.body.status}, uptime {response.body.uptime.toFixed(1)}s
        </p>
      ) : (
        <p>API недоступен, статус {response.status}</p>
      )}
    </section>
  );
};

export default DevPage;
```

- [ ] **Step 5: Установить зависимости и проверить страницу**

```bash
pnpm install
pnpm db:up
pnpm turbo run dev mock > /tmp/turbo-all.log 2>&1 &
TURBO_PID=$!
sleep 18
curl -s http://localhost:3000/dev | grep -o 'API: ok, uptime [0-9.]*s'
```

Expected: строка вида `API: ok, uptime 12.4s`.

- [ ] **Step 6: Проверить, что типизация настоящая**

Временно заменить в `page.tsx` строку `{response.body.status}` на `{response.body.statusz}` и выполнить:

```bash
pnpm --filter @pnewmo/web typecheck
```

Expected: ошибка TypeScript про отсутствующее свойство `statusz`. Это доказывает, что типы из Zod-схемы реально дошли до фронтенда через workspace-пакет. После проверки вернуть строку обратно и убедиться, что `typecheck` снова зелёный.

- [ ] **Step 7: Проверить, что старые страницы не сломались**

```bash
for u in / /catalog/gidravlika /product/1 /dev; do printf "%s -> " "$u"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$u"; done
kill $TURBO_PID
```

Expected: четыре строки `200`.

- [ ] **Step 8: Коммит**

```bash
git add apps/web
git commit -m "feat: add /dev route consuming the shared contract

Closes the web -> api-contract -> api loop and makes the monorepo
wiring visible. Verified type safety propagates: a typo in a response
field fails typecheck in the web app.

This route is the placeholder for CRUD test components in later stages."
```

---

### Task 7: Онбординг — `README`, правка `AGENTS.md`, проверка с нуля

**Files:**
- Create: `README.md` (заменяет текущий, в нём сейчас одна строка)
- Modify: `AGENTS.md`
- Delete: `apps/web/reedme.txt`

**Interfaces:**
- Consumes: все команды из Task 2–6.
- Produces: воспроизводимый онбординг. Финальная проверка выполняется на свежем клоне, а не в рабочем дереве.

- [ ] **Step 1: Написать `README.md`**

````markdown
# Pnewmo

Каталог промышленного оборудования: гидравлика, пневматика, вакуумная техника.

Монорепо: Next.js фронтенд, NestJS API, общий контракт на ts-rest, Postgres в Docker.

## Требования

- Node 24 (`nvm use` подхватит из `.nvmrc`)
- pnpm 10: `npm i -g pnpm@10`
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
apps/web              Next.js, фронтенд и служебный роут /dev
apps/api              NestJS, HTTP API
packages/api-contract  ts-rest + Zod, общий контракт для web и api
docs/superpowers      спеки и планы
```

## Команды

| Команда | Что делает |
|---|---|
| `pnpm bootstrap` | создаёт `.env` из примеров, ставит зависимости |
| `pnpm dev` | Postgres + web + api + mock |
| `pnpm build` | сборка всех пакетов |
| `pnpm lint` | eslint и stylelint |
| `pnpm typecheck` | проверка типов |
| `pnpm db:up` / `db:down` | поднять / остановить Postgres, данные сохраняются |
| `pnpm db:reset` | снести данные и поднять базу заново |
| `pnpm db:psql` | psql-шелл в контейнере |

## Известные проблемы окружения

**Corepack не работает на этой конфигурации.** Под Node 20 закешированный pnpm 11 падает с `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`, под Node 23 — `Cannot find matching keyid` из-за устаревших ключей подписи реестра. Ставьте pnpm через `npm i -g pnpm@10`. Если corepack всё же нужен: `COREPACK_INTEGRITY_KEYS=0 corepack prepare pnpm@10.20.0 --activate`.

**Node 20 не поддерживается.** EOL с 30 апреля 2026, security-патчей нет.

## Схема базы данных

Пока отсутствует: Postgres поднимается пустым. Prisma, схема и доменные модули — следующие этапы, см. `docs/superpowers/specs/`.
````

- [ ] **Step 2: Поправить устаревший раздел в `AGENTS.md`**

Раздел утверждает, что `dev` переведён с Turbopack на Webpack из-за паники Rust-компилятора на Tailwind v4. Это больше не так: в Next 16 Turbopack включён по умолчанию, и проект на нём собирается за 267 мс.

Заменить пункт 4 в разделе «2. Предпринятые действия для решения» на:

```markdown
4. **Turbopack (актуальное состояние на 2026-08-11):**
   Отключение Turbopack больше не требуется. В Next 16 он включён по
   умолчанию, и проект собирается на нём без сбоев — старая паника
   `turbo-tasks/src/manager.rs` не воспроизводится. Скрипт `dev` —
   обычный `next dev`. Откат на Webpack, если понадобится: `next dev --webpack`.
```

В разделе «3. Результат» заменить строку про Webpack на:

```markdown
* **Сборщик:** Turbopack, включён по умолчанию в Next 16.
```

- [ ] **Step 3: Удалить `reedme.txt`**

```bash
git rm -q apps/web/reedme.txt
```

Его содержимое — инструкция по ручному запуску json-server. Теперь это задача `mock`, а команды описаны в `README.md`.

- [ ] **Step 4: Коммит**

```bash
git add -A
git commit -m "docs: add onboarding README and correct the stale Turbopack note

AGENTS.md claimed dev had been switched off Turbopack because of a Rust
compiler panic. Next 16 enables Turbopack by default and the project
builds on it in 267ms, so the note misled anyone reading project context.

Drops reedme.txt: the json-server command it documented is now the mock
turbo task."
```

- [ ] **Step 5: Проверить онбординг на свежем клоне**

Главная проверка этапа. Выполняется в отдельной директории, чтобы исключить влияние текущего `node_modules` и `.env`.

```bash
rm -rf /tmp/pnewmo-onboard
git clone -q --branch dev . /tmp/pnewmo-onboard
cd /tmp/pnewmo-onboard
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use
pnpm bootstrap
pnpm build
```

Expected: `pnpm bootstrap` создаёт три `.env`-файла, `pnpm build` проходит зелёным.

Postgres в этой проверке не поднимается: контейнер и порт 5432 общие с основным деревом, два экземпляра конфликтуют. Работа базы уже проверена в Task 3.

- [ ] **Step 6: Прибрать за проверкой**

```bash
cd /Users/daniildalinchuk/My-projects/Nazz
rm -rf /tmp/pnewmo-onboard
```

- [ ] **Step 7: Пройти по критериям готовности из спека**

```bash
pnpm db:up
pnpm turbo run dev mock > /tmp/final-check.log 2>&1 &
FINAL_PID=$!
sleep 20
for u in / /catalog/gidravlika /product/1 /dev; do printf "web%s -> " "$u"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$u"; done
printf "api/health -> "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/health
kill $FINAL_PID
pnpm typecheck && pnpm lint && pnpm build
git status --short
```

Expected: пять раз `200`, три зелёные команды, `git status --short` пустой.

Сверить с разделом «Критерии готовности» спека: пункты 1–8 должны быть закрыты. Пункт 5 (`db:psql`, сохранность данных) закрыт в Task 3, пункт 7 (`git log --follow`) — в Task 2.

---

## Что осознанно не делается в этом плане

- Prisma, схема БД, миграции, сиды — этап 3. Причина в спеке: `prisma generate` не работает без хотя бы одной модели.
- Перевод фронтенда с json-server на реальный API — этап 4. В этапе 1 `/catalog` и `/product` продолжают читать `db.json`.
- Prod-сборка, Dockerfile'ы приложений, CI, выбор хостинга.
- Скилл `nestjs-expert`, `backend-style-guide.md`, агенты ревью — этап 2.
- Обновление `@types/node` в `apps/web` с `^20` до `^24`. Формально версия типов теперь отстаёт от рантайма, но менять её посреди перестройки — лишний риск: новые определения могут вскрыть ошибки типов в существующем коде фронтенда. Пир-зависимость `@ts-rest/core` (`^18.18.7 || >=20.8.4`) диапазоном `^20` удовлетворена. Отдельная мелкая задача на потом.
