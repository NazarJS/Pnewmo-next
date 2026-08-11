import { initContract } from '@ts-rest/core';

import { healthContract } from './health.contract';

const c = initContract();

export const contract = c.router({
  health: healthContract,
});

export * from './health.contract';
