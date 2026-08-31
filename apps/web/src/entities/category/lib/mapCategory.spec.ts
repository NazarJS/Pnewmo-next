import type { Category as CategoryDto } from '@pnewmo/api-contract';

import { buildCategoryTree } from './categoryTree';
import { mapCategory } from './mapCategory';

describe('mapCategory', () => {
  it('переводит parentId API в parent_id фронтенда', () => {
    const result = mapCategory({ id: 5, parentId: 2, path: '2.5', slug: 'cilindry', name: 'Цилиндры' });

    expect(result.parent_id).toBe(2);
  });

  it('сохраняет null у корневой категории', () => {
    const result = mapCategory({ id: 1, parentId: null, path: '1', slug: 'pnevmatika', name: 'Пневматика' });

    expect(result.parent_id).toBeNull();
  });

  it('собирает url из слага', () => {
    const result = mapCategory({ id: 1, parentId: null, path: '1', slug: 'pnevmatika', name: 'Пневматика' });

    expect(result.url).toBe('/catalog/pnevmatika');
  });

  it('переносит путь без изменений', () => {
    const result = mapCategory({ id: 87, parentId: 14, path: '2.14.87', slug: 'iso', name: 'ISO 15552' });

    expect(result.path).toBe('2.14.87');
  });
});

describe('дерево категорий из ответа API', () => {
  /**
   * DTO в форме, в которой их реально отдаёт API: parentId camelCase,
   * без url. Без маппинга buildCategoryTree читает parent_id, находит
   * undefined у всех узлов и возвращает пустой массив — меню тихо пропадёт.
   */
  const dtos: CategoryDto[] = [
    { id: 1, parentId: null, path: '1', slug: 'pnevmatika', name: 'Пневматика' },
    { id: 2, parentId: 1, path: '1.2', slug: 'cilindry', name: 'Цилиндры' },
    { id: 3, parentId: 2, path: '1.2.3', slug: 'iso', name: 'ISO 15552' },
  ];

  it('строится непустым и с реальной вложенностью после маппинга', () => {
    const tree = buildCategoryTree(dtos.map(mapCategory));

    expect(tree.length).toBeGreaterThan(0);

    const [root] = tree;
    const child = root.children.find((category) => category.id === 2);

    expect(child).toBeDefined();
    expect(child?.children.some((category) => category.id === 3)).toBe(true);
  });
});
