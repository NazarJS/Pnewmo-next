import { AppError } from '../common/errors/app-error.enum';
import { AppException } from '../common/errors/app.exception';
import { CategoriesRepository, CategoryRow } from './categories.repository';
import { CategoriesService } from './categories.service';

/**
 * Дерево для тестов:
 *   1 Гидравлика
 *     └ 2 Смазочная техника
 *         └ 3 Станции насосные
 *   4 Пневматика (не связана с первой ветвью)
 */
const rows: CategoryRow[] = [
  { id: 1, parentId: null, path: '1', slug: 'gidravlika', name: 'Гидравлика' },
  { id: 2, parentId: 1, path: '1.2', slug: 'smazka', name: 'Смазочная техника' },
  { id: 3, parentId: 2, path: '1.2.3', slug: 'stancii', name: 'Станции насосные' },
  { id: 4, parentId: null, path: '4', slug: 'pnevmatika', name: 'Пневматика' },
];

// Pick даёт литералу контекстную типизацию: без него параметры стали бы
// неявными any и strict-режим отверг бы файл.
type RepositoryStub = Pick<
  CategoriesRepository,
  | 'getList'
  | 'getById'
  | 'getParentId'
  | 'countChildren'
  | 'countProducts'
  | 'create'
  | 'update'
  | 'remove'
>;

// Количество товаров по id категории: используется только в describe про
// remove, остальным тестам безразлично — там везде 0. Категория 4 — лист без
// подкатегорий, поэтому проверка countChildren её не остановит раньше времени.
const productsByCategory = new Map<number, number>([[4, 3000]]);

function makeRepository(): CategoriesRepository {
  const byId = new Map(rows.map((row) => [row.id, row]));

  const stub: RepositoryStub = {
    getList: () => Promise.resolve(rows),
    getById: (id) => Promise.resolve(byId.get(id) ?? null),
    getParentId: (id) => {
      const row = byId.get(id);

      return Promise.resolve(row ? { parentId: row.parentId } : null);
    },
    countChildren: (id) => Promise.resolve(rows.filter((row) => row.parentId === id).length),
    countProducts: (id) => Promise.resolve(productsByCategory.get(id) ?? 0),
    create: (data) => Promise.resolve({ id: 99, path: '99', ...data }),
    update: (id, data) => Promise.resolve({ ...(byId.get(id) as CategoryRow), ...data }),
    remove: (id) => Promise.resolve(byId.get(id) as CategoryRow),
  };

  // Двойное приведение необходимо: у класса есть приватное поле prisma, поэтому
  // структурного совпадения недостаточно.
  return stub as unknown as CategoriesRepository;
}

async function expectAppError(operation: Promise<unknown>, code: AppError): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AppException);
  await expect(operation).rejects.toMatchObject({ code });
}

describe('CategoriesService.update — защита от цикла', () => {
  let service: CategoriesService;

  beforeEach(() => {
    service = new CategoriesService(makeRepository());
  });

  it('отклоняет категорию как родителя самой себя', async () => {
    await expectAppError(service.update(1, { parentId: 1 }), AppError.VALIDATION_FAILED);
  });

  it('отклоняет прямого потомка как родителя', async () => {
    await expectAppError(service.update(1, { parentId: 2 }), AppError.VALIDATION_FAILED);
  });

  it('отклоняет потомка третьего уровня как родителя', async () => {
    await expectAppError(service.update(1, { parentId: 3 }), AppError.VALIDATION_FAILED);
  });
});

describe('CategoriesService.update — запрет смены родителя', () => {
  let service: CategoriesService;

  beforeEach(() => {
    service = new CategoriesService(makeRepository());
  });

  it('отклоняет смену родителя на другую существующую категорию', async () => {
    // Сама по себе валидная цель (не цикл, родитель существует) — отказ именно
    // потому, что path поддерева не пересчитывается, а не из-за формы запроса.
    await expectAppError(service.update(1, { parentId: 4 }), AppError.CONFLICT);
  });

  it('отклоняет перенос категории в корень', async () => {
    await expectAppError(service.update(2, { parentId: null }), AppError.CONFLICT);
  });

  it('разрешает обновление, когда parentId совпадает с текущим', async () => {
    const updated = await service.update(2, { parentId: 1 });

    expect(updated.parentId).toBe(1);
  });

  it('разрешает обновление, когда текущий и переданный parentId — null', async () => {
    const updated = await service.update(4, { parentId: null });

    expect(updated.parentId).toBeNull();
  });

  it('разрешает обновление без parentId в теле запроса', async () => {
    const updated = await service.update(1, { name: 'Гидравлика и смазка' });

    expect(updated.name).toBe('Гидравлика и смазка');
  });
});

describe('CategoriesService.create', () => {
  let service: CategoriesService;

  beforeEach(() => {
    service = new CategoriesService(makeRepository());
  });

  it('отклоняет несуществующего родителя', async () => {
    await expectAppError(
      service.create({ name: 'Новая', slug: 'novaya', parentId: 777 }),
      AppError.VALIDATION_FAILED,
    );
  });

  it('создаёт корневую категорию', async () => {
    const created = await service.create({ name: 'Новая', slug: 'novaya', parentId: null });

    expect(created.slug).toBe('novaya');
  });
});

describe('CategoriesService.remove', () => {
  let service: CategoriesService;

  beforeEach(() => {
    service = new CategoriesService(makeRepository());
  });

  it('отклоняет удаление категории с потомками', async () => {
    await expectAppError(service.remove(1), AppError.CONFLICT);
  });

  it('отклоняет удаление категории с товарами', async () => {
    await expectAppError(service.remove(4), AppError.CONFLICT);
  });

  it('удаляет лист', async () => {
    const removed = await service.remove(3);

    expect(removed).toEqual({ id: 3 });
  });
});

describe('CategoriesService.getById', () => {
  it('бросает NOT_FOUND для неизвестного идентификатора', async () => {
    const service = new CategoriesService(makeRepository());

    await expectAppError(service.getById(777), AppError.NOT_FOUND);
  });
});
