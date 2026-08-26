import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const healthSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
});

export type Health = z.infer<typeof healthSchema>;

export const healthContract = c.router({
  check: {
    method: 'GET',
    path: '/health',
    responses: {
      200: healthSchema,
    },
    summary: 'Liveness probe',
  },
});
