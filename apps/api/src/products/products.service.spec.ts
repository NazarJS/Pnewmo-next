import { AppError } from '../common/errors/app-error.enum';
import { AppException } from '../common/errors/app.exception';
import { ProductRow, ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

/**
 * Дерево категорий:
 *   1 «Пневматика»              путь «1»          товаров нет
 *     └ 2 «Цилиндры»            путь «1.2»        товар 10
 *         └ 3 «ISO 15552»       путь «1.2.3»      товар 11
 *   4 «Фитинги»                 путь «4»          товар 12
 *
 * Проверяемое поведение: запрос по категории 1 обязан вернуть товары 10 и 11
 * и не вернуть 12.
 */
const rows: ProductRow[] = [
  {
    id: 10,
    externalId: 'a',
    categoryId: 2,
    name: 'Цилиндр',
    imageUrl: 'a.webp',
    price: '100.00',
    quantity: null,
    unit: null,
    description: '',
    aiDescription: '',
    specifications: {},
    specificationsFull: {},
  },
  {
    id: 11,
    externalId: 'b',
    categoryId: 3,
    name: 'Цилиндр ISO',
    imageUrl: 'b.webp',
    price: null,
    quantity: null,
    unit: null,
    description: '',
    aiDescription: '',
    specifications: {},
    specificationsFull: {},
  },
  {
    id: 12,
    externalId: 'c',
    categoryId: 4,
    name: 'Фитинг',
    imageUrl: 'c.webp',
    price: '5.50',
    quantity: null,
    unit: null,
    description: '',
    aiDescription: '',
    specifications: {},
    specificationsFull: {},
  },
];

const paths = new Map<number, string>([
  [1, '1'],
  [2, '1.2'],
  [3, '1.2.3'],
  [4, '4'],
]);

type RepositoryStub = Pick<
  ProductsRepository,
  'getList' | 'getById' | 'getCategoryPath' | 'create' | 'update' | 'remove'
>;

function makeRepository(): ProductsRepository {
  const stub: RepositoryStub = {
    getCategoryPath: (id) => Promise.resolve(paths.has(id) ? { path: paths.get(id)! } : null),
    getList: ({ pathPrefix, offset, limit }) => {
      const matched =
        pathPrefix === undefined
          ? rows
          : rows.filter((row) => {
              const path = paths.get(row.categoryId) ?? '';

              return path === pathPrefix || path.startsWith(`${pathPrefix}.`);
            });

      return Promise.resolve({
        items: matched.slice(offset, offset + limit),
        total: matched.length,
      });
    },
    getById: (id) => Promise.resolve(rows.find((row) => row.id === id) ?? null),
    create: () => Promise.resolve(rows[0]),
    update: () => Promise.resolve(rows[0]),
    remove: () => Promise.resolve(rows[0]),
  };

  return stub as ProductsRepository;
}

describe('ProductsService.getList', () => {
  it('возвращает товары всего поддерева, включая собственные товары категории', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ categoryId: 2, offset: 0, limit: 24 });

    expect(result.items.map((item) => item.id)).toEqual([10, 11]);
    expect(result.total).toBe(2);
  });

  it('от корня отдаёт товары всех потомков', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ categoryId: 1, offset: 0, limit: 24 });

    expect(result.items.map((item) => item.id)).toEqual([10, 11]);
  });

  it('не подмешивает товары соседней ветки', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ categoryId: 1, offset: 0, limit: 24 });

    expect(result.items.map((item) => item.id)).not.toContain(12);
  });

  it('без категории отдаёт весь каталог', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ offset: 0, limit: 24 });

    expect(result.total).toBe(3);
  });

  it('на несуществующей категории бросает NOT_FOUND, а не пустой список', async () => {
    const service = new ProductsService(makeRepository());

    await expect(service.getList({ categoryId: 999, offset: 0, limit: 24 })).rejects.toMatchObject({
      code: AppError.NOT_FOUND,
    });
  });

  it('total не зависит от размера страницы', async () => {
    const service = new ProductsService(makeRepository());

    const result = await service.getList({ categoryId: 1, offset: 0, limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(2);
  });
});

describe('ProductsService.getById', () => {
  it('бросает NOT_FOUND на отсутствующем товаре', async () => {
    const service = new ProductsService(makeRepository());

    await expect(service.getById(404)).rejects.toBeInstanceOf(AppException);
  });
});
