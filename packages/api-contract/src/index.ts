import { initContract } from '@ts-rest/core';

import { categoryContract } from './category.contract';
import { healthContract } from './health.contract';

const c = initContract();

export const contract = c.router({
  health: healthContract,
  categories: categoryContract,
});

export * from './app-error';
export * from './category.contract';
export * from './health.contract';
