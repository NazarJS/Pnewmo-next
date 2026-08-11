import { z } from 'zod';

/**
 * Единая форма тела для всех ошибок API. Одна схема на домменные ошибки и на
 * провалы валидации: клиенту не приходится разбирать два разных формата.
 * Поле issues заполняется только при провале валидации.
 */
export const appErrorSchema = z.object({
  errorCode: z.string(),
  message: z.string(),
  issues: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

export type AppErrorBody = z.infer<typeof appErrorSchema>;
