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
