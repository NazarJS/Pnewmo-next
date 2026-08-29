import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface CategoryRow {
  id: number;
  parentId: number | null;
  path: string;
  slug: string;
  name: string;
}

// Явный select вместо выборки всей строки: createdAt и updatedAt наружу не
// нужны, а то, что не выбрано, невозможно случайно отдать клиенту.
const columns = { id: true, parentId: true, path: true, slug: true, name: true } as const;

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

  countChildren(id: number): Promise<number> {
    return this.prisma.category.count({ where: { parentId: id } });
  }

  countProducts(id: number): Promise<number> {
    return this.prisma.product.count({ where: { categoryId: id } });
  }

  /**
   * Вставка и достройка пути в одной транзакции: путь требует собственного
   * идентификатора, который известен только после INSERT, а строка с пустым
   * путём не должна быть видна другим запросам даже на мгновение.
   */
  create(data: { name: string; slug: string; parentId: number | null }): Promise<CategoryRow> {
    return this.prisma.$transaction(async (tx) => {
      const parent =
        data.parentId === null
          ? null
          : await tx.category.findUnique({ where: { id: data.parentId }, select: { path: true } });

      const created = await tx.category.create({
        data: { ...data, path: '' },
        select: { id: true },
      });

      const path = parent === null ? String(created.id) : `${parent.path}.${created.id}`;

      return tx.category.update({ where: { id: created.id }, data: { path }, select: columns });
    });
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
