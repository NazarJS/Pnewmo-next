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
      data: { name: 'Гидравлика', slug: 'gidravlika', parentId: null },
      select: { id: true },
    });
    const mid = await prisma.category.create({
      data: { name: 'Смазочная техника', slug: 'smazka', parentId: root.id },
      select: { id: true },
    });
    const leaf = await prisma.category.create({
      data: { name: 'Станции насосные', slug: 'stancii', parentId: mid.id },
      select: { id: true },
    });

    rootId = root.id;
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

  it('удаляет лист', async () => {
    const response = await request(app.getHttpServer()).delete(`/categories/${leafId}`).expect(200);

    expect(response.body).toEqual({ id: leafId });
  });

  it('возвращает 409 при удалении категории с потомками', async () => {
    const response = await request(app.getHttpServer()).delete(`/categories/${rootId}`).expect(409);

    expect(appErrorSchema.parse(response.body).errorCode).toBe('CONFLICT');
  });
});
