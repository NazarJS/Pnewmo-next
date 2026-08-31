import { deriveProductGridState } from './deriveProductGridState';

describe('deriveProductGridState', () => {
  it('запрос ещё не завершился — состояние загрузки', () => {
    expect(deriveProductGridState({ isPending: true, data: undefined })).toEqual({
      isLoading: true,
      isError: false,
      isEmpty: false,
      message: 'Загрузка...',
    });
  });

  it('ответ не 200 — состояние ошибки', () => {
    const state = deriveProductGridState({ isPending: false, data: { status: 404, body: { message: 'x' } } });

    expect(state).toEqual({
      isLoading: false,
      isError: true,
      isEmpty: false,
      message: 'Не удалось загрузить товары',
    });
  });

  it('успешный ответ с total 0 — пустая категория, а не ошибка', () => {
    const state = deriveProductGridState({ isPending: false, data: { status: 200, body: { total: 0 } } });

    expect(state).toEqual({
      isLoading: false,
      isError: false,
      isEmpty: true,
      message: 'В этой категории пока нет товаров',
    });
  });

  it('успешный ответ с товарами — сообщения нет, грид можно рисовать', () => {
    const state = deriveProductGridState({ isPending: false, data: { status: 200, body: { total: 3 } } });

    expect(state).toEqual({
      isLoading: false,
      isError: false,
      isEmpty: false,
      message: null,
    });
  });
});
