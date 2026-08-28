import { FixtureCategory } from './catalog-fixture.lib';

export function depthOf(path: string): number {
  return path.split('.').length;
}

/**
 * Порядок вставки — по возрастанию глубины: внешний ключ требует, чтобы
 * родитель уже существовал. Сортировка устойчивая, поэтому порядок категорий
 * одного уровня сохраняется как в фикстуре, и идентификаторы между прогонами
 * получаются предсказуемыми.
 */
export function buildInsertOrder(categories: FixtureCategory[]): FixtureCategory[] {
  return [...categories].sort((a, b) => depthOf(a.path) - depthOf(b.path));
}

/**
 * Настоящий путь считается из идентификаторов базы, а не из позиционных путей
 * фикстуры: позиционные нужны лишь чтобы связать родителя с потомком при
 * загрузке.
 */
export function computePath(parentPath: string | null, id: number): string {
  return parentPath === null ? String(id) : `${parentPath}.${id}`;
}
