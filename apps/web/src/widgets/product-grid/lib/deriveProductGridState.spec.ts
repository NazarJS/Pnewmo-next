import type { Product } from '@/entities/product/lib/types';

import { deriveProductGridState } from './deriveProductGridState';

const product: Product = {
  id: 1,
  externalId: 'ext-1',
  categoryId: 1,
  name: 'Товар',
  imageUrl: '/image.jpg',
  price: '100.00',
  quantity: '1',
  unit: 'шт',
  description: '',
  aiDescription: '',
  specifications: {},
  specificationsFull: {},
};

describe('deriveProductGridState', () => {
  it('запрос ещё не завершился — состояние загрузки, данных для рендера нет', () => {
    expect(deriveProductGridState({ isPending: true, data: undefined })).toEqual({
      isLoading: true,
      isError: false,
      isEmpty: false,
      message: 'Загрузка...',
      data: null,
    });
  });

  it('ответ не 200 — состояние ошибки, данных для рендера нет', () => {
    const state = deriveProductGridState({ isPending: false, data: { status: 404, body: { message: 'x' } } });

    expect(state).toEqual({
      isLoading: false,
      isError: true,
      isEmpty: false,
      message: 'Не удалось загрузить товары',
      data: null,
    });
  });

  it('успешный ответ с total 0 — пустая категория, а не ошибка, данных для рендера нет', () => {
    const state = deriveProductGridState({ isPending: false, data: { status: 200, body: { items: [], total: 0 } } });

    expect(state).toEqual({
      isLoading: false,
      isError: false,
      isEmpty: true,
      message: 'В этой категории пока нет товаров',
      data: null,
    });
  });

  it('успешный ответ с товарами — сообщения нет, деривация отдаёт суженные данные для грида', () => {
    const state = deriveProductGridState({
      isPending: false,
      data: { status: 200, body: { items: [product], total: 1 } },
    });

    expect(state).toEqual({
      isLoading: false,
      isError: false,
      isEmpty: false,
      message: null,
      data: { items: [product], total: 1 },
    });
  });
});
