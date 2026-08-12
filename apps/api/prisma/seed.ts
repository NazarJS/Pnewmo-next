import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Форма записи в фикстуре — как в моке json-server. Поля id, parent_id и path
 * используются только здесь: чтобы определить порядок вставки и связать
 * родителей с потомками. В базу они не попадают, идентификаторы выдаёт Postgres.
 */
interface MockCategory {
  id: string | number;
  parent_id: string | number | null;
  path: string;
  slug: string;
  name: string;
}

function loadFixture(): MockCategory[] {
  const raw = readFileSync(join(__dirname, 'seed', 'categories.json'), 'utf8');

  return JSON.parse(raw) as MockCategory[];
}

function depthOf(category: MockCategory): number {
  return String(category.path).split('.').length;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL не задан');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // TRUNCATE, а не deleteMany: onDelete Restrict проверяется немедленно на
    // каждой строке, поэтому массовое удаление самоссылающейся таблицы падает в
    // зависимости от порядка строк. RESTART IDENTITY делает идентификаторы
    // предсказуемыми между прогонами, CASCADE понадобится, когда на categories
    // будут ссылаться товары.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE categories RESTART IDENTITY CASCADE');

    // Вставка по возрастанию глубины: внешний ключ требует, чтобы родитель уже
    // существовал.
    const ordered = [...loadFixture()].sort((a, b) => depthOf(a) - depthOf(b));
    const idMap = new Map<string, number>();

    for (const category of ordered) {
      const mockId = String(category.id);
      const mockParentId = category.parent_id === null ? null : String(category.parent_id);

      let parentId: number | null = null;

      if (mockParentId !== null) {
        const mapped = idMap.get(mockParentId);

        if (mapped === undefined) {
          throw new Error(
            `Родитель ${mockParentId} категории ${mockId} ещё не вставлен — проверьте поле path в фикстуре`,
          );
        }

        parentId = mapped;
      }

      const created = await prisma.category.create({
        data: { name: category.name, slug: category.slug, parentId },
        select: { id: true },
      });

      idMap.set(mockId, created.id);
    }

    console.log(`seeded ${idMap.size} categories`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
