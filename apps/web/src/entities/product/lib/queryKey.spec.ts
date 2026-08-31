import { buildProductListQuery, buildProductListQueryKey } from './queryKey';
import { ProductListFilterState } from './types';

describe('buildProductListQueryKey', () => {
  it('собирает позиционный массив', () => {
    const filter: ProductListFilterState = { categoryId: 7, offset: 24, limit: 24 };

    expect(buildProductListQueryKey(filter)).toEqual(['product-list', 7, 24, 24]);
  });

  it('отсутствие категории превращает в null, а не пропускает поле', () => {
    const filter: ProductListFilterState = { categoryId: undefined, offset: 0, limit: 24 };

    expect(buildProductListQueryKey(filter)).toEqual(['product-list', null, 0, 24]);
  });

  /**
   * Главная проверка. Ключ обязан не зависеть от порядка полей в объекте:
   * сервер в префетче и клиент в хуке собирают фильтр независимо, и при
   * JSON.stringify два одинаковых по смыслу фильтра дали бы разные строки —
   * страница молча ушла бы за данными второй раз при гидрации.
   */
  it('не зависит от порядка полей в объекте-источнике', () => {
    const a = { categoryId: 7, offset: 24, limit: 24 } as ProductListFilterState;
    const b = { limit: 24, offset: 24, categoryId: 7 } as ProductListFilterState;

    expect(buildProductListQueryKey(a)).toEqual(buildProductListQueryKey(b));
  });
});

describe('buildProductListQuery', () => {
  it('поля query соответствуют полям ключа', () => {
    const filter: ProductListFilterState = { categoryId: 7, offset: 24, limit: 24 };
    const key = buildProductListQueryKey(filter);
    const query = buildProductListQuery(filter);

    expect([key[1], key[2], key[3]]).toEqual([query.categoryId ?? null, query.offset, query.limit]);
  });

  it('undefined категории не уходит в query', () => {
    const query = buildProductListQuery({ categoryId: undefined, offset: 0, limit: 24 });

    expect(query.categoryId).toBeUndefined();
  });
});
