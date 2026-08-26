import { Controller } from '@nestjs/common';
import { contract, type Category } from '@pnewmo/api-contract';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { CategoryRow } from './categories.repository';
import { CategoriesService } from './categories.service';

/**
 * Явный маппинг, хотя CategoryRow сейчас совпадает с DTO по форме. Смысл в
 * границе: если select в репозитории когда-нибудь расширят, лишние поля не
 * уедут клиенту автоматически.
 */
function toDto(row: CategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parentId,
    slug: row.slug,
    name: row.name,
  };
}

@Controller()
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @TsRestHandler(contract.categories.list)
  list() {
    return tsRestHandler(contract.categories.list, async () => ({
      status: 200 as const,
      body: (await this.service.getList()).map(toDto),
    }));
  }

  @TsRestHandler(contract.categories.getById)
  getById() {
    return tsRestHandler(contract.categories.getById, async ({ params }) => ({
      status: 200 as const,
      body: toDto(await this.service.getById(params.id)),
    }));
  }

  @TsRestHandler(contract.categories.create)
  create() {
    return tsRestHandler(contract.categories.create, async ({ body }) => ({
      status: 201 as const,
      body: toDto(await this.service.create(body)),
    }));
  }

  @TsRestHandler(contract.categories.update)
  update() {
    return tsRestHandler(contract.categories.update, async ({ params, body }) => ({
      status: 200 as const,
      body: toDto(await this.service.update(params.id, body)),
    }));
  }

  @TsRestHandler(contract.categories.remove)
  remove() {
    return tsRestHandler(contract.categories.remove, async ({ params }) => ({
      status: 200 as const,
      body: await this.service.remove(params.id),
    }));
  }
}
