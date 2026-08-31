export * from './lib/queryKey';
export * from './lib/types';
export * from './api/hook';

// api/prefetch НЕ реэкспортируем: он тянет tsr.initQueryClient → серверный
// код, который в клиентском бандле ломается не на сборке, а в рантайме.
// Серверные компоненты импортируют prefetchProductList напрямую из
// './api/prefetch' — тот же приём, что и у entities/category/index.ts.
