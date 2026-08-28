import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { appErrorSchema } from './app-error';

const c = initContract();

export const productSchema = z.object({
  id: z.number().int(),
  externalId: z.string(),
  categoryId: z.number().int(),
  name: z.string(),
  imageUrl: z.string(),
  // Цена и количество ходят строками, а не числами. Prisma отдаёт Decimal, и
  // превращение его в number возвращает ту самую потерю точности, ради которой
  // Decimal и выбран: 21493.96 становится 21493.959999999999. Форматирует
  // фронтенд.
  price: z.string().nullable(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  description: z.string(),
  aiDescription: z.string(),
  specifications: z.record(z.string()),
  specificationsFull: z.record(z.string()),
});

export type Product = z.infer<typeof productSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1).max(1000),
  categoryId: z.number().int().positive(),
  imageUrl: z.string().max(2000),
  // Строка, а не число: Decimal через JSON ходит строкой, и форма ввода отдаёт
  // строку. Регулярка допускает две цифры после точки — копейки.
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Цена — число с точкой, не больше двух знаков после неё')
    .nullable(),
  specifications: z.record(z.string()).default({}),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// coerce обязателен: параметры строки запроса приходят строками, обычный
// z.number() отверг бы любой корректный запрос.
export const productListQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().gte(0).default(0),
  // Потолок в 100 — не косметика. Без него первый же обход бота с limit=100000
  // вытащит всю таблицу и сериализует её в JSON. Дефолт 24 кратен трём и
  // четырём: сетка карточек раскладывается без огрызка.
  limit: z.coerce.number().int().gt(0).max(100).default(24),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

export const productContract = c.router({
  list: {
    method: 'GET',
    path: '/products',
    query: productListQuerySchema,
    responses: {
      200: z.object({
        items: z.array(productSchema),
        total: z.number().int().gte(0),
      }),
      404: appErrorSchema,
    },
    summary: 'Товары категории с пагинацией; категория раскрывается в поддерево',
  },
  getById: {
    method: 'GET',
    path: '/products/:id',
    pathParams: idParam,
    responses: { 200: productSchema, 404: appErrorSchema },
    summary: 'Товар по идентификатору',
  },
  create: {
    method: 'POST',
    path: '/products',
    body: createProductSchema,
    responses: { 201: productSchema, 400: appErrorSchema, 409: appErrorSchema },
    summary: 'Создать товар',
  },
  update: {
    method: 'PATCH',
    path: '/products/:id',
    pathParams: idParam,
    body: updateProductSchema,
    responses: { 200: productSchema, 400: appErrorSchema, 404: appErrorSchema },
    summary: 'Изменить товар',
  },
  remove: {
    method: 'DELETE',
    path: '/products/:id',
    pathParams: idParam,
    responses: { 200: z.object({ id: z.number().int() }), 404: appErrorSchema },
    summary: 'Удалить товар',
  },
});
