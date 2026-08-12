import { contract } from '@pnewmo/api-contract';
import { initClient } from '@ts-rest/core';

export const api = initClient(contract, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  baseHeaders: {},
});
