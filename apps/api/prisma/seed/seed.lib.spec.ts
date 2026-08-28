import { buildInsertOrder, computePath, depthOf } from './seed.lib';

describe('depthOf', () => {
  it('считает глубину по числу сегментов пути', () => {
    expect(depthOf('1')).toBe(1);
    expect(depthOf('1.2.3')).toBe(3);
  });
});

describe('buildInsertOrder', () => {
  it('сортирует категории по возрастанию глубины', () => {
    const ordered = buildInsertOrder([
      { path: '1.2.3', slug: 'c', name: 'C' },
      { path: '1', slug: 'a', name: 'A' },
      { path: '1.2', slug: 'b', name: 'B' },
    ]);

    expect(ordered.map((c) => c.path)).toEqual(['1', '1.2', '1.2.3']);
  });

  it('не переставляет категории одной глубины', () => {
    const ordered = buildInsertOrder([
      { path: '2', slug: 'b', name: 'B' },
      { path: '1', slug: 'a', name: 'A' },
    ]);

    expect(ordered.map((c) => c.path)).toEqual(['2', '1']);
  });
});

describe('computePath', () => {
  it('у корня путь равен идентификатору', () => {
    expect(computePath(null, 7)).toBe('7');
  });

  it('у потомка путь равен пути родителя плюс собственный идентификатор', () => {
    expect(computePath('2.14', 87)).toBe('2.14.87');
  });
});
