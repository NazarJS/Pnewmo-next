import { findRootCategoryIdBySlug } from './categoryTree';
import { Category } from './types';

const categories: Category[] = [
  { id: 1, parent_id: null, path: '1', slug: 'gidravlika', name: 'Гидравлика', url: '/catalog/gidravlika' },
  { id: 2, parent_id: 1, path: '1.2', slug: 'nasosy', name: 'Насосы', url: '/catalog/nasosy' },
  { id: 3, parent_id: 2, path: '1.2.3', slug: 'shesterennye', name: 'Шестерённые', url: '/catalog/shesterennye' },
  { id: 4, parent_id: null, path: '4', slug: 'pnevmatika', name: 'Пневматика', url: '/catalog/pnevmatika' },
];

describe('findRootCategoryIdBySlug', () => {
  it('слаг не передан (страница вне каталога) — null', () => {
    expect(findRootCategoryIdBySlug(categories, null)).toBeNull();
  });

  it('слаг не найден среди категорий — null', () => {
    expect(findRootCategoryIdBySlug(categories, 'no-such-slug')).toBeNull();
  });

  it('слаг корневой категории — возвращает её собственный id', () => {
    expect(findRootCategoryIdBySlug(categories, 'gidravlika')).toBe(1);
  });

  it('слаг категории третьего уровня — поднимается до корня', () => {
    expect(findRootCategoryIdBySlug(categories, 'shesterennye')).toBe(1);
  });

  it('другая ветка дерева — свой корень, не первый в списке', () => {
    expect(findRootCategoryIdBySlug(categories, 'pnevmatika')).toBe(4);
  });
});
