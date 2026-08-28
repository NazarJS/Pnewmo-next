import { initContract } from '@ts-rest/core';

import { categoryContract } from './category.contract';
import { healthContract } from './health.contract';
import { productContract } from './product.contract';

const c = initContract();

export const contract = c.router({
  health: healthContract,
  categories: categoryContract,
  products: productContract,
});

export * from './app-error';
export * from './category.contract';
export * from './health.contract';
export * from './product.contract';
