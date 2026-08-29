import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ProductRow {
  id: number;
  externalId: string;
  categoryId: number;
  name: string;
  imageUrl: string;
  price: string | null;
  quantity: string | null;
  unit: string | null;
  description: string;
  aiDescription: string;
  specifications: Record<string, string>;
  specificationsFull: Record<string, string>;
}

export interface ListParams {
  pathPrefix?: string;
  offset: number;
  limit: number;
}

const columns = {
  id: true,
  externalId: true,
  categoryId: true,
  name: true,
  imageUrl: true,
  price: true,
  quantity: true,
  unit: true,
  description: true,
  aiDescription: true,
  specifications: true,
  specificationsFull: true,
} as const;

type RawRow = {
  // Decimal, а не unknown: у него собственный toString(), и без точного типа
  // линтер не поручится, что String() не даст «[object Object]».
  price: Prisma.Decimal | null;
  quantity: Prisma.Decimal | null;
  specifications: unknown;
  specificationsFull: unknown;
} & Omit<ProductRow, 'price' | 'quantity' | 'specifications' | 'specificationsFull'>;

/**
 * Decimal и Json из Prisma приводятся к форме контракта здесь, а не в
 * контроллере: наружу из репозитория должен выходить обычный объект, иначе
 * Decimal утечёт в сервис и однажды попадёт в арифметику.
 */
function toRow(raw: RawRow): ProductRow {
  return {
    ...raw,
    price: raw.price === null ? null : String(raw.price),
    quantity: raw.quantity === null ? null : String(raw.quantity),
    specifications: (raw.specifications ?? {}) as Record<string, string>,
    specificationsFull: (raw.specificationsFull ?? {}) as Record<string, string>,
  };
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  getCategoryPath(id: number): Promise<{ path: string } | null> {
    return this.prisma.category.findUnique({ where: { id }, select: { path: true } });
  }

  /**
   * Список и счётчик в одной транзакции. Порознь между ними может пройти
   * вставка, и total разойдётся со страницей — на глаз это выглядит как
   * исчезающий последний товар.
   */
  async getList({
    pathPrefix,
    offset,
    limit,
  }: ListParams): Promise<{ items: ProductRow[]; total: number }> {
    // Условие берёт и саму категорию, и потомков. Без первой половины страница
    // категории теряла бы её собственные товары.
    const where =
      pathPrefix === undefined
        ? {}
        : { category: { OR: [{ path: pathPrefix }, { path: { startsWith: `${pathPrefix}.` } }] } };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: columns,
        orderBy: { id: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: items.map((item) => toRow(item as RawRow)), total };
  }

  async getById(id: number): Promise<ProductRow | null> {
    const found = await this.prisma.product.findUnique({ where: { id }, select: columns });

    return found === null ? null : toRow(found);
  }

  async create(data: {
    name: string;
    categoryId: number;
    imageUrl: string;
    price: string | null;
    specifications: Record<string, string>;
  }): Promise<ProductRow> {
    const created = await this.prisma.product.create({
      data: {
        ...data,
        externalId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      select: columns,
    });

    return toRow(created);
  }

  async update(
    id: number,
    data: {
      name?: string;
      categoryId?: number;
      imageUrl?: string;
      price?: string | null;
      specifications?: Record<string, string>;
    },
  ): Promise<ProductRow> {
    const updated = await this.prisma.product.update({ where: { id }, data, select: columns });

    return toRow(updated);
  }

  async remove(id: number): Promise<ProductRow> {
    const removed = await this.prisma.product.delete({ where: { id }, select: columns });

    return toRow(removed);
  }
}
