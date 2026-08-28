import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { FixtureCategory, FixtureProduct } from './seed/catalog-fixture.lib';
import { buildInsertOrder, computePath } from './seed/seed.lib';

interface Fixture {
  categories: FixtureCategory[];
  products: FixtureProduct[];
}

/** Вставка товаров пачками: 4842 отдельных запроса — это минуты вместо секунд. */
const BATCH_SIZE = 500;

function loadFixture(): Fixture {
  return JSON.parse(readFileSync(join(__dirname, 'seed', 'catalog.json'), 'utf8')) as Fixture;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL не задан');
  }

  const force = process.argv.includes('--force');
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const existing = await prisma.product.count();

    // Сторожевое условие. Требование звучало как «залить один раз у всех,
    // дальше не трогать»: сид вызывается на каждом `pnpm dev`, но работает
    // ровно однажды — на пустой таблице сразу после миграции.
    //
    // Следствие, и оно желаемое: как только через админку создадут первый
    // товар, сид не сработает больше никогда и не сможет затереть введённое
    // руками.
    if (existing > 0 && !force) {
      console.log(`seed: пропущено, в базе уже ${existing} товаров (--force для перезаливки)`);

      return;
    }

    // TRUNCATE, а не deleteMany: onDelete Restrict проверяется немедленно на
    // каждой строке, поэтому массовое удаление самоссылающейся таблицы падает в
    // зависимости от порядка строк. CASCADE снимает товары вместе с категориями.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE categories, products RESTART IDENTITY CASCADE');

    const fixture = loadFixture();
    // Позиционный путь фикстуры -> идентификатор и настоящий путь в базе.
    const inserted = new Map<string, { id: number; path: string }>();

    for (const category of buildInsertOrder(fixture.categories)) {
      const segments = category.path.split('.');
      const parentFixturePath = segments.slice(0, -1).join('.');
      const parent = parentFixturePath === '' ? null : inserted.get(parentFixturePath);

      if (parentFixturePath !== '' && parent === undefined) {
        throw new Error(
          `Родитель ${parentFixturePath} категории ${category.path} ещё не вставлен — проверьте порядок в фикстуре`,
        );
      }

      const created = await prisma.category.create({
        data: {
          name: category.name,
          slug: category.slug,
          parentId: parent?.id ?? null,
          // Временное значение: настоящий путь требует собственного
          // идентификатора, который известен только после вставки.
          //
          // Колонка `path` уникальна, и держится этот приём исключительно на
          // последовательности цикла: каждая итерация проставляет настоящий
          // путь до того, как вставится следующая строка, поэтому двух пустых
          // значений одновременно не бывает. Переделка на пакетную вставку
          // (`createMany`) сломает инвариант — один INSERT с несколькими
          // пустыми путями упадёт на уникальном индексе. Упадёт громко, но
          // знать об этом надо заранее.
          path: '',
        },
        select: { id: true },
      });

      const path = computePath(parent?.path ?? null, created.id);

      await prisma.category.update({ where: { id: created.id }, data: { path } });

      inserted.set(category.path, { id: created.id, path });
    }

    let done = 0;

    for (let i = 0; i < fixture.products.length; i += BATCH_SIZE) {
      const batch = fixture.products.slice(i, i + BATCH_SIZE).map((product) => {
        const category = inserted.get(product.categoryPath);

        if (category === undefined) {
          throw new Error(
            `Категория ${product.categoryPath} товара ${product.externalId} не найдена`,
          );
        }

        return {
          externalId: product.externalId,
          categoryId: category.id,
          name: product.name,
          imageUrl: product.imageUrl,
          price: product.price,
          specifications: product.specifications,
        };
      });

      await prisma.product.createMany({ data: batch });
      done += batch.length;
    }

    console.log(`seeded ${inserted.size} categories, ${done} products`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
