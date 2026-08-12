---
name: nestjs-expert
description: Use when writing or reviewing backend code in apps/api or packages/api-contract — adding a module, service, repository, controller or contract route, deciding which layer a piece of logic belongs in, shaping an error response, or writing tests for either. Also for questions about Prisma, ts-rest, Zod or NestJS layering in this project.
---

# NestJS в этом проекте

Бэкенд `apps/api` построен слоями: контроллер маппит, сервис решает, репозиторий
спрашивает базу. Домен не знает про HTTP. Контракт в `packages/api-contract` —
единственный источник правды об API.

## Порядок чтения

| Файл | Когда |
|---|---|
| `references/principles.md` | любая задача по бэкенду: где чему место и почему |
| `references/patterns.md` | создание модуля, рефакторинг, код-ревью |
| `.claude/context/backend-style-guide.md` | нужен готовый шаблон кода и правила именования |

Для любой задачи достаточно `principles.md`. При создании нового модуля или ревью
добавляется `patterns.md`.

## Главное в одном абзаце

`PrismaService` инжектится **только** в репозиторий. Репозиторий всегда с явным
`select` и возвращает свой тип, а не сущность Prisma. Сервис бросает `AppException` с
кодом `AppError` и не знает про статусы. Контроллер маппит в DTO контракта и не содержит
правил. Путь и метод роута живут в контракте, а не в декораторе контроллера.

## Prisma 7, а не 6

Самая частая ошибка: применить рецепт из интернета для шестой версии. В седьмой
генератор называется `prisma-client`, `output` обязателен, а рантайм требует
драйвер-адаптера — `new PrismaClient({ adapter })` вокруг `pg.Pool`. `datasourceUrl` и
конструктор без аргументов не работают. Подробности и обходы для Jest — в разделе
«Грабли окружения» стайлгайда.
