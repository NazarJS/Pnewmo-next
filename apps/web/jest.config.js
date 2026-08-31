/**
 * Раньше один-единственный project: testEnvironment 'node' на всё, потому что
 * тестировались только чистые функции (разбор пагинации, сборка ключей,
 * маппинг DTO, форматирование цены) — DOM им не нужен, а jsdom стоит секунд
 * запуска и лишней зависимости. Теперь появились рендер-тесты React-компонентов
 * (HeaderCatalog.spec.tsx), которым jsdom нужен по-настоящему: useState,
 * useMemo, реальный DOM для проверки className/текста.
 *
 * Смешивать всё в одном project с testEnvironment: 'jsdom' — не вариант: он
 * стоит времени запуска на каждом чистом .spec.ts, которых в разы больше.
 * Поэтому — Jest projects, маршрутизация по расширению файла: .spec.ts
 * (без x) остаётся в 'node', .spec.tsx уходит в 'jsdom'. Существующие .spec.ts
 * не переехали ни строкой — testRegex у node-проекта побайтово тот же, что
 * был здесь раньше.
 */
const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
};

module.exports = {
  projects: [
    {
      displayName: 'node',
      rootDir: '.',
      roots: ['<rootDir>/src'],
      testEnvironment: 'node',
      testRegex: '.*\\.spec\\.ts$',
      moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
      transform: { '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }] },
      moduleNameMapper,
    },
    {
      displayName: 'jsdom',
      rootDir: '.',
      roots: ['<rootDir>/src'],
      testEnvironment: 'jsdom',
      testRegex: '.*\\.spec\\.tsx$',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.jsdom.js'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
      transform: { '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }] },
      moduleNameMapper: {
        ...moduleNameMapper,
        // CSS-модули в jsdom-рендере: HeaderCatalog и его поддерево импортируют
        // *.module.scss ради className. identity-obj-proxy возвращает имя
        // свойства как значение (styles.active -> 'active'), поэтому тест может
        // проверять className по смыслу, не мокая сами компоненты.
        '\\.(scss|sass|css)$': 'identity-obj-proxy',
      },
    },
  ],
};
