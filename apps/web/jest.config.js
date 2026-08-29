/**
 * testEnvironment: 'node', а не jsdom. Всё, что тестируется на этом этапе, —
 * чистые функции: разбор пагинации, сборка ключей, маппинг DTO, форматирование
 * цены. DOM им не нужен, а jsdom стоит секунд запуска и лишней зависимости.
 * Когда понадобится рендер компонентов, окружение меняется здесь одной строкой.
 */
module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: { '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
