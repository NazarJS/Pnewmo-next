<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Контекст проекта

Основной контекст — [`.claude/CLAUDE.md`](.claude/CLAUDE.md): структура монорепо, стек
с версиями, жёсткие ограничения и указатели на стайлгайд, скиллы и спеки.

Команды запуска и особенности окружения — [`README.md`](README.md).

## История

Отчёт об устранении сбоя сборки Next.js, ранее лежавший в этом файле, перенесён в
[`docs/nextjs-build-incident.md`](docs/nextjs-build-incident.md). Он объясняет, откуда
в проекте настройка `onlyBuiltDependencies`, но описывает состояние до перестройки в
монорепо и актуальным руководством не является.
