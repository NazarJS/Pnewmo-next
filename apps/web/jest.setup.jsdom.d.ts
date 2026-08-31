// Глобальная типизация матчеров jest-dom (toBeInTheDocument, toHaveClass и
// т.п.) для tsc — jest.setup.jsdom.js подключает их только в рантайме Jest,
// tsc про них не знает без явной ссылки на типы пакета.
/// <reference types="@testing-library/jest-dom" />
