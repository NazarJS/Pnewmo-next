import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface CategoryRow {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
}

// Явный select вместо выборки всей строки: createdAt и updatedAt наружу не
// нужны, а то, что не выбрано, невозможно случайно отдать клиенту.
const columns = { id: true, parentId: true, slug: true, name: true } as const;

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  getList(): Promise<CategoryRow[]> {
    return this.prisma.category.findMany({
      select: columns,
      orderBy: [{ parentId: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
    });
  }

  getById(id: number): Promise<CategoryRow | null> {
    return this.prisma.category.findUnique({ where: { id }, select: columns });
  }

  /**
   * Узкий метод под обход дерева вверх в защите от цикла: выбирать всю строку
   * ради одного поля незачем, а подставлять такой метод в тестах проще всего.
   */
  getParentId(id: number): Promise<{ parentId: number | null } | null> {
    return this.prisma.category.findUnique({ where: { id }, select: { parentId: true } });
  }

  create(data: { name: string; slug: string; parentId: number | null }): Promise<CategoryRow> {
    return this.prisma.category.create({ data, select: columns });
  }

  update(
    id: number,
    data: { name?: string; slug?: string; parentId?: number | null },
  ): Promise<CategoryRow> {
    return this.prisma.category.update({ where: { id }, data, select: columns });
  }

  remove(id: number): Promise<CategoryRow> {
    return this.prisma.category.delete({ where: { id }, select: columns });
  }
}
