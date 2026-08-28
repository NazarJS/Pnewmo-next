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
    // Карта расширена с id на пару (id, path): путь потомка собирается из пути
    // родителя, а не из id фикстуры — идентификаторы в базе назначает Postgres
    // и они не совпадают с id из мока.
    const idMap = new Map<string, { id: number; path: string }>();

    for (const category of ordered) {
      const mockId = String(category.id);
      const mockParentId = category.parent_id === null ? null : String(category.parent_id);

      let parentId: number | null = null;
      let parentPath: string | null = null;

      if (mockParentId !== null) {
        const mapped = idMap.get(mockParentId);

        if (mapped === undefined) {
          throw new Error(
            `Родитель ${mockParentId} категории ${mockId} ещё не вставлен — проверьте поле path в фикстуре`,
          );
        }

        parentId = mapped.id;
        parentPath = mapped.path;
      }

      // path достраивается вторым запросом: он требует собственного
      // идентификатора, известного только после INSERT. Временный путь ''
      // не виден другим строкам дольше одной итерации — цикл последовательный,
      // и уникальность path не конфликтует, так как следующая вставка
      // происходит уже после того, как эта строка получила настоящий путь.
      const created = await prisma.category.create({
        data: { name: category.name, slug: category.slug, parentId, path: '' },
        select: { id: true },
      });

      const path = parentPath === null ? String(created.id) : `${parentPath}.${created.id}`;

      await prisma.category.update({ where: { id: created.id }, data: { path } });

      idMap.set(mockId, { id: created.id, path });
    }

    console.log(`seeded ${idMap.size} categories`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
