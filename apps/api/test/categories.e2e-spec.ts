import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { appErrorSchema, categorySchema } from '@pnewmo/api-contract';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const categoryListSchema = z.array(categorySchema);

describe('categories', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let rootId: number;
  let midId: number;
  let leafId: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Каждый тест начинает с одинакового дерева: root -> mid -> leaf.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE categories RESTART IDENTITY CASCADE');

    const root = await prisma.category.create({
      data: { name: 'Гидравлика', slug: 'gidravlika', parentId: null, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: root.id }, data: { path: String(root.id) } });

    const mid = await prisma.category.create({
      data: { name: 'Смазочная техника', slug: 'smazka', parentId: root.id, path: '' },
      select: { id: true },
    });
    await prisma.category.update({ where: { id: mid.id }, data: { path: `${root.id}.${mid.id}` } });

    const leaf = await prisma.category.create({
      data: { name: 'Станции насосные', slug: 'stancii', parentId: mid.id, path: '' },
      select: { id: true },
    });
    await prisma.category.update({
      where: { id: leaf.id },
      data: { path: `${root.id}.${mid.id}.${leaf.id}` },
    });

    rootId = root.id;
    midId = mid.id;
    leafId = leaf.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('отдаёт список категорий', async () => {
    const response = await request(app.getHttpServer()).get('/categories').expect(200);
    const body = categoryListSchema.parse(response.body);

    expect(body).toHaveLength(3);
    expect(body.map((category) => category.slug)).toContain('gidravlika');
  });

  it('отдаёт категорию по идентификатору', async () => {
    const response = await request(app.getHttpServer()).get(`/categories/${rootId}`).expect(200);

    expect(categorySchema.parse(response.body).slug).toBe('gidravlika');
  });

  it('возвращает 404 для неизвестного идентификатора', async () => {
    const response = await request(app.getHttpServer()).get('/categories/999999').expect(404);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('NOT_FOUND');
  });

  it('создаёт категорию с валидным родителем', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Питатели', slug: 'pitateli', parentId: rootId })
      .expect(201);

    expect(categorySchema.parse(response.body).parentId).toBe(rootId);

    const list = await request(app.getHttpServer()).get('/categories').expect(200);

    expect(categoryListSchema.parse(list.body)).toHaveLength(4);
  });

  it('считает путь создаваемой категории от родителя', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Новая', slug: 'novaya', parentId: rootId })
      .expect(201);

    const created = categorySchema.parse(response.body);

    expect(created.path).toBe(`${rootId}.${created.id}`);
  });

  it('у корневой категории путь равен её идентификатору', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Корневая', slug: 'kornevaya', parentId: null })
      .expect(201);

    const created = categorySchema.parse(response.body);

    expect(created.path).toBe(String(created.id));
  });

  it('возвращает 409 на занятый slug', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Дубликат', slug: 'gidravlika', parentId: null })
      .expect(409);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('CONFLICT');
  });

  it('возвращает 400 на несуществующего родителя', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Сирота', slug: 'sirota', parentId: 999999 })
      .expect(400);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('VALIDATION_FAILED');
  });

  it('возвращает 400 и issues на slug в верхнем регистре', async () => {
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Плохой слаг', slug: 'BadSlug', parentId: null })
      .expect(400);

    const body = appErrorSchema.parse(response.body);

    expect(body.errorCode).toBe('VALIDATION_FAILED');
    expect(body.issues?.length).toBeGreaterThan(0);
  });

  it('переименовывает категорию', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/categories/${rootId}`)
      .send({ name: 'Гидравлика и смазка' })
      .expect(200);

    expect(categorySchema.parse(response.body).name).toBe('Гидравлика и смазка');
  });

  it('отклоняет перенос категории в собственного потомка', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/categories/${rootId}`)
      .send({ parentId: leafId })
      .expect(400);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('VALIDATION_FAILED');
  });

  it('отклоняет смену родителя на другую, не связанную цикл категорию', async () => {
    // leaf -> mid сейчас; перенос на rootId не создаёт цикл (root — предок, не
    // потомок leaf), но всё равно запрещён: path поддерева не пересчитывается.
    const response = await request(app.getHttpServer())
      .patch(`/categories/${leafId}`)
      .send({ parentId: rootId })
      .expect(409);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('CONFLICT');
  });

  it('разрешает обновление, когда parentId совпадает с текущим', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/categories/${leafId}`)
      .send({ parentId: midId, name: 'Станции насосные и компрессорные' })
      .expect(200);

    expect(categorySchema.parse(response.body).name).toBe('Станции насосные и компрессорные');
  });

  it('удаляет лист', async () => {
    const response = await request(app.getHttpServer()).delete(`/categories/${leafId}`).expect(200);

    expect(response.body).toEqual({ id: leafId });
  });

  it('возвращает 409 при удалении категории с товарами', async () => {
    await prisma.product.create({
      data: {
        externalId: 'cat-e2e-product',
        categoryId: leafId,
        name: 'Станция насосная',
        imageUrl: 'a.webp',
      },
    });

    const response = await request(app.getHttpServer()).delete(`/categories/${leafId}`).expect(409);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('CONFLICT');
  });

  it('возвращает 409 при удалении категории с потомками', async () => {
    const response = await request(app.getHttpServer()).delete(`/categories/${rootId}`).expect(409);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('CONFLICT');
  });
});
