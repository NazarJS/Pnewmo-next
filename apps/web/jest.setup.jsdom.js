// Матчеры toBeInTheDocument/toHaveClass и т.п. — только для рендер-тестов
// (jsdom project); node-проекту, где тестируются чистые функции без DOM,
// этот файл не нужен и не подключён. import, а не require: ts-jest
// транспилирует этот .js (allowJs в tsconfig) в CommonJS сам, а
// @typescript-eslint/no-require-imports запрещает require() в исходниках.
import '@testing-library/jest-dom';
