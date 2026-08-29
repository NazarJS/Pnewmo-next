import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { appErrorSchema, productSchema } from '@pnewmo/api-contract';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const listSchema = z.object({ items: z.array(productSchema), total: z.number().int().gte(0) });

describe('products', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let rootId: number;
  let midId: number;
  let siblingId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE categories, products RESTART IDENTITY CASCADE');

    // Дерево: root -> mid; отдельно sibling. Товары висят на mid и sibling.
    const root = await prisma.category.create({
      data: { name: 'Пневматика', slug: 'pnevmatika', parentId: null, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: root.id }, data: { path: String(root.id) } });

    const mid = await prisma.category.create({
      data: { name: 'Цилиндры', slug: 'cilindry', parentId: root.id, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: mid.id }, data: { path: `${root.id}.${mid.id}` } });

    const sibling = await prisma.category.create({
      data: { name: 'Фитинги', slug: 'fitingi', parentId: null, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: sibling.id }, data: { path: String(sibling.id) } });

    await prisma.product.createMany({
      data: [
        {
          externalId: 'p1',
          categoryId: mid.id,
          name: 'Цилиндр 1',
          imageUrl: 'a.webp',
          price: '100.00',
        },
        {
          externalId: 'p2',
          categoryId: mid.id,
          name: 'Цилиндр 2',
          imageUrl: 'b.webp',
          price: '200.00',
          // Незначащий ноль в дробной части — регрессия на toRow(): String(Decimal)
          // отбросил бы его («29829.6»), toFixed(3) обязан сохранить.
          quantity: '29829.600',
        },
        {
          externalId: 'p3',
          categoryId: sibling.id,
          name: 'Фитинг',
          imageUrl: 'c.webp',
          price: null,
        },
      ],
    });

    rootId = root.id;
    midId = mid.id;
    siblingId = sibling.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('от корня отдаёт товары поддерева и не отдаёт соседнюю ветку', async () => {
    const response = await request(app.getHttpServer())
      .get(`/products?categoryId=${rootId}`)
      .expect(200);
    const body = listSchema.parse(response.body);

    expect(body.total).toBe(2);
    expect(body.items.map((item) => item.name)).toEqual(['Цилиндр 1', 'Цилиндр 2']);
  });

  it('без категории отдаёт весь каталог', async () => {
    const response = await request(app.getHttpServer()).get('/products').expect(200);

    expect(listSchema.parse(response.body).total).toBe(3);
  });

  it('total не зависит от limit', async () => {
    const response = await request(app.getHttpServer())
      .get(`/products?categoryId=${rootId}&limit=1`)
      .expect(200);
    const body = listSchema.parse(response.body);

    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(2);
  });

  it('offset сдвигает окно', async () => {
    const response = await request(app.getHttpServer())
      .get(`/products?categoryId=${rootId}&offset=1&limit=1`)
      .expect(200);

    expect(listSchema.parse(response.body).items[0].name).toBe('Цилиндр 2');
  });

  it('отвергает limit больше сотни', async () => {
    await request(app.getHttpServer()).get('/products?limit=100000').expect(400);
  });

  it('на несуществующей категории отвечает 404', async () => {
    await request(app.getHttpServer()).get('/products?categoryId=999999').expect(404);
  });

  it('отдаёт цену строкой без потери копеек', async () => {
    const response = await request(app.getHttpServer())
      .get(`/products?categoryId=${midId}`)
      .expect(200);

    expect(listSchema.parse(response.body).items[0].price).toBe('100.00');
  });

  it('отдаёт количество строкой с исходным масштабом, без количества — null', async () => {
    const response = await request(app.getHttpServer())
      .get(`/products?categoryId=${midId}`)
      .expect(200);
    const items = listSchema.parse(response.body).items;

    expect(items[0].quantity).toBeNull();
    expect(items[1].quantity).toBe('29829.600');
  });

  it('создаёт товар', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .send({
        name: 'Новый',
        categoryId: siblingId,
        imageUrl: 'n.webp',
        price: '9.99',
        specifications: {},
      })
      .expect(201);

    expect(productSchema.parse(response.body).name).toBe('Новый');
  });

  it('отвергает создание в несуществующей категории', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({
        name: 'Новый',
        categoryId: 999999,
        imageUrl: 'n.webp',
        price: null,
        specifications: {},
      })
      .expect(400);
  });

  it('PATCH меняет имя и не затирает specifications', async () => {
    const created = await request(app.getHttpServer())
      .post('/products')
      .send({
        name: 'До правки',
        categoryId: siblingId,
        imageUrl: 'n.webp',
        price: null,
        specifications: { Материал: 'Сталь' },
      })
      .expect(201);
    const id = productSchema.parse(created.body).id;

    const patched = await request(app.getHttpServer())
      .patch(`/products/${id}`)
      .send({ name: 'После правки' })
      .expect(200);

    const body = productSchema.parse(patched.body);

    expect(body.name).toBe('После правки');
    // createProductSchema.partial() оборачивает specifications (с .default({}))
    // в ZodOptional: при отсутствующем ключе Zod возвращает значение до того,
    // как успевает сработать default, поэтому в Prisma .update() ключ не
    // попадает вовсе, а не приходит как «{}» — иначе характеристики бы стёрлись.
    expect(body.specifications).toEqual({ Материал: 'Сталь' });
  });

  it('PATCH с несуществующим categoryId отвечает 400', async () => {
    const list = await request(app.getHttpServer())
      .get(`/products?categoryId=${midId}`)
      .expect(200);
    const id = listSchema.parse(list.body).items[0].id;

    const response = await request(app.getHttpServer())
      .patch(`/products/${id}`)
      .send({ categoryId: 999999 })
      .expect(400);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('VALIDATION_FAILED');
  });

  it('удаляет товар', async () => {
    const list = await request(app.getHttpServer())
      .get(`/products?categoryId=${midId}`)
      .expect(200);
    const id = listSchema.parse(list.body).items[0].id;

    await request(app.getHttpServer()).delete(`/products/${id}`).expect(200);
    await request(app.getHttpServer()).get(`/products/${id}`).expect(404);
  });
});
