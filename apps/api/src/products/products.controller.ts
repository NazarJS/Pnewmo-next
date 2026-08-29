import { Controller } from '@nestjs/common';
import { contract, type Product } from '@pnewmo/api-contract';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { ProductRow } from './products.repository';
import { ProductsService } from './products.service';

/**
 * Явный маппинг, хотя ProductRow сейчас совпадает с DTO по форме. Смысл в
 * границе: если select в репозитории расширят, лишние поля не уедут клиенту
 * автоматически. То же решение, что в CategoriesController.
 */
function toDto(row: ProductRow): Product {
  return {
    id: row.id,
    externalId: row.externalId,
    categoryId: row.categoryId,
    name: row.name,
    imageUrl: row.imageUrl,
    price: row.price,
    quantity: row.quantity,
    unit: row.unit,
    description: row.description,
    aiDescription: row.aiDescription,
    specifications: row.specifications,
    specificationsFull: row.specificationsFull,
  };
}

@Controller()
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @TsRestHandler(contract.products.list)
  list() {
    return tsRestHandler(contract.products.list, async ({ query }) => {
      const result = await this.service.getList({
        categoryId: query.categoryId,
        offset: query.offset,
        limit: query.limit,
      });

      return {
        status: 200 as const,
        body: { items: result.items.map(toDto), total: result.total },
      };
    });
  }

  @TsRestHandler(contract.products.getById)
  getById() {
    return tsRestHandler(contract.products.getById, async ({ params }) => ({
      status: 200 as const,
      body: toDto(await this.service.getById(params.id)),
    }));
  }

  @TsRestHandler(contract.products.create)
  create() {
    return tsRestHandler(contract.products.create, async ({ body }) => ({
      status: 201 as const,
      body: toDto(await this.service.create(body)),
    }));
  }

  @TsRestHandler(contract.products.update)
  update() {
    return tsRestHandler(contract.products.update, async ({ params, body }) => ({
      status: 200 as const,
      body: toDto(await this.service.update(params.id, body)),
    }));
  }

  @TsRestHandler(contract.products.remove)
  remove() {
    return tsRestHandler(contract.products.remove, async ({ params }) => ({
      status: 200 as const,
      body: await this.service.remove(params.id),
    }));
  }
}
