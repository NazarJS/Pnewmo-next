import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { appErrorSchema } from './app-error';

const c = initContract();

export const categorySchema = z.object({
  id: z.number().int(),
  parentId: z.number().int().nullable(),
  slug: z.string(),
  name: z.string(),
});

export type Category = z.infer<typeof categorySchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    // Своё сообщение вместо дефолтного «Invalid»: этот текст увидит человек в
    // форме админки, и он должен объяснять, что именно не так.
    .regex(
      /^[a-z0-9_-]+$/,
      'Допустимы только строчные латинские буквы, цифры, дефис и подчёркивание',
    ),
  parentId: z.number().int().positive().nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// coerce обязателен: параметр пути приходит строкой, и обычный z.number()
// отверг бы любой корректный запрос как «не число».
const idParam = z.object({ id: z.coerce.number().int().positive() });

export const categoryContract = c.router({
  list: {
    method: 'GET',
    path: '/categories',
    responses: {
      200: z.array(categorySchema),
    },
    summary: 'Все категории плоским списком',
  },
  getById: {
    method: 'GET',
    path: '/categories/:id',
    pathParams: idParam,
    responses: {
      200: categorySchema,
      404: appErrorSchema,
    },
    summary: 'Категория по идентификатору',
  },
  create: {
    method: 'POST',
    path: '/categories',
    body: createCategorySchema,
    responses: {
      201: categorySchema,
      400: appErrorSchema,
      409: appErrorSchema,
    },
    summary: 'Создать категорию',
  },
  update: {
    method: 'PATCH',
    path: '/categories/:id',
    pathParams: idParam,
    body: updateCategorySchema,
    responses: {
      200: categorySchema,
      400: appErrorSchema,
      404: appErrorSchema,
      409: appErrorSchema,
    },
    summary: 'Изменить категорию',
  },
  remove: {
    method: 'DELETE',
    path: '/categories/:id',
    pathParams: idParam,
    responses: {
      200: z.object({ id: z.number().int() }),
      404: appErrorSchema,
      409: appErrorSchema,
    },
    summary: 'Удалить категорию',
  },
});
