import { resolveLimit, resolvePage, toOffset } from '@/shared/lib/pagination';

import { DEFAULT_PAGE, PRODUCTS_PER_PAGE } from './constants';
import { parseCatalogUrlState, toSearchParamsGetter } from './parseCatalogUrlState';

describe('parseCatalogUrlState', () => {
  it('без page/limit в адресе подставляет дефолты продукта', () => {
    const state = parseCatalogUrlState(new URLSearchParams());

    expect(state.page).toBe(DEFAULT_PAGE);
    expect(state.limit).toBe(PRODUCTS_PER_PAGE);
    expect(state.offset).toBe(0);
  });

  it('page/limit берутся из query и приводят к offset', () => {
    const state = parseCatalogUrlState(new URLSearchParams('page=3&limit=48'));

    expect(state.page).toBe(3);
    expect(state.limit).toBe(48);
    expect(state.offset).toBe(96);
  });

  /**
   * Паритет с серверным разбором — главный риск задачи. Если бы здесь была
   * своя копия логики, а не общие resolvePage/resolveLimit/toOffset, эта
   * проверка не поймала бы расхождение: обе стороны считали бы "одинаково",
   * просто по разным формулам. Сравниваем с прямым вызовом тех же функций,
   * которыми пользуется parseCatalogUrlState внутри.
   */
  it('совпадает с прямым вызовом resolvePage/resolveLimit/toOffset на мусорном вводе', () => {
    const state = parseCatalogUrlState(new URLSearchParams('page=0.5&limit=100000'));

    const expectedPage = resolvePage(0.5, DEFAULT_PAGE);
    const expectedLimit = resolveLimit(100000, PRODUCTS_PER_PAGE);

    expect(state.page).toBe(expectedPage);
    expect(state.limit).toBe(expectedLimit);
    expect(state.offset).toBe(toOffset(expectedPage, expectedLimit));
  });
});

describe('toSearchParamsGetter', () => {
  it('читает значение по ключу как URLSearchParams.get', () => {
    const getter = toSearchParamsGetter({ page: '3' });

    expect(getter.get('page')).toBe('3');
  });

  it('повтор параметра в адресе (массив) — берёт первое значение, как readNumberParam', () => {
    const getter = toSearchParamsGetter({ limit: ['48', '24'] });

    expect(getter.get('limit')).toBe('48');
  });

  it('отсутствующий ключ — null, а не undefined, как у настоящего URLSearchParams', () => {
    const getter = toSearchParamsGetter({});

    expect(getter.get('missing')).toBeNull();
  });

  /**
   * Тест на сам факт задачи 2: серверная страница и клиент обязаны звать
   * одну композицию. Если бы toSearchParamsGetter или parseCatalogUrlState
   * были продублированы, это сравнение — единственное место, которое
   * поймало бы расхождение раньше продакшена.
   */
  it('parseCatalogUrlState через адаптер над Record даёт тот же результат, что и через настоящий URLSearchParams', () => {
    const viaAdapter = parseCatalogUrlState(toSearchParamsGetter({ page: '2', limit: '10' }));
    const viaUrlSearchParams = parseCatalogUrlState(new URLSearchParams('page=2&limit=10'));

    expect(viaAdapter).toEqual(viaUrlSearchParams);
  });
});
