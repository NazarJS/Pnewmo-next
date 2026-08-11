import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthSchema } from '@pnewmo/api-contract';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';

describe('GET /health', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds with a body matching the contract schema', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    // Parsing with the contract's own schema asserts the whole shape, not just
    // the fields this test happens to read, and yields a typed value.
    expect(() => healthSchema.parse(response.body)).not.toThrow();
  });

  it('reports ok', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    const body = healthSchema.parse(response.body);

    expect(body.status).toBe('ok');
  });

  it('reports uptime as a positive number', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    const body = healthSchema.parse(response.body);

    expect(body.uptime).toBeGreaterThan(0);
  });
});
