import { resolveLimit, resolvePage, toOffset } from '@/shared/lib/pagination';

import { DEFAULT_PAGE, PRODUCTS_PER_PAGE } from './constants';
import { parseCatalogUrlState } from './parseCatalogUrlState';

describe('parseCatalogUrlState', () => {
  it('достаёт слаг категории из пути', () => {
    const state = parseCatalogUrlState('/catalog/gidravlika', new URLSearchParams());

    expect(state.categorySlug).toBe('gidravlika');
  });

  it('вложенный сегмент пути не попадает в слаг — берётся только первый', () => {
    const state = parseCatalogUrlState('/catalog/gidravlika/extra', new URLSearchParams());

    expect(state.categorySlug).toBe('gidravlika');
  });

  it('вне /catalog/[slug] слага нет', () => {
    expect(parseCatalogUrlState('/', new URLSearchParams()).categorySlug).toBeNull();
    expect(parseCatalogUrlState('/product/42', new URLSearchParams()).categorySlug).toBeNull();
    expect(parseCatalogUrlState('/admin', new URLSearchParams()).categorySlug).toBeNull();
  });

  it('без page/limit в адресе подставляет дефолты продукта', () => {
    const state = parseCatalogUrlState('/catalog/gidravlika', new URLSearchParams());

    expect(state.page).toBe(DEFAULT_PAGE);
    expect(state.limit).toBe(PRODUCTS_PER_PAGE);
    expect(state.offset).toBe(0);
  });

  it('page/limit берутся из query и приводят к offset', () => {
    const state = parseCatalogUrlState('/catalog/gidravlika', new URLSearchParams('page=3&limit=48'));

    expect(state.page).toBe(3);
    expect(state.limit).toBe(48);
    expect(state.offset).toBe(96);
  });

  /**
   * Паритет с серверным разбором — главный риск задачи. Если бы здесь была
   * своя копия логики, а не общие resolvePage/resolveLimit/toOffset, эта
   * проверка не поймала бы расхождение: обе стороны считали бы "одинаково",
   * просто по разным формулам. Сравниваем с прямым вызовом тех же функций,
   * которыми пользуется app/catalog/[slug]/page.tsx.
   */
  it('совпадает с прямым вызовом resolvePage/resolveLimit/toOffset на мусорном вводе', () => {
    const state = parseCatalogUrlState('/catalog/gidravlika', new URLSearchParams('page=0.5&limit=100000'));

    const expectedPage = resolvePage(0.5, DEFAULT_PAGE);
    const expectedLimit = resolveLimit(100000, PRODUCTS_PER_PAGE);

    expect(state.page).toBe(expectedPage);
    expect(state.limit).toBe(expectedLimit);
    expect(state.offset).toBe(toOffset(expectedPage, expectedLimit));
  });
});
