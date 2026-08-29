import { Injectable } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.enum';
import { AppException } from '../common/errors/app.exception';
import { ProductRow, ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}

  async getList(params: { categoryId?: number; offset: number; limit: number }): Promise<{
    items: ProductRow[];
    total: number;
  }> {
    let pathPrefix: string | undefined;

    if (params.categoryId !== undefined) {
      const category = await this.repository.getCategoryPath(params.categoryId);

      // NOT_FOUND, а не пустой список: запрос к несуществующей категории — это
      // ошибка клиента, и молчаливый пустой ответ её прячет. Опечатка в ссылке
      // выглядела бы как «в категории нет товаров».
      if (!category) {
        throw new AppException(AppError.NOT_FOUND, `Категория ${params.categoryId} не найдена`);
      }

      pathPrefix = category.path;
    }

    return this.repository.getList({ pathPrefix, offset: params.offset, limit: params.limit });
  }

  async getById(id: number): Promise<ProductRow> {
    const product = await this.repository.getById(id);

    if (!product) {
      throw new AppException(AppError.NOT_FOUND, `Товар ${id} не найден`);
    }

    return product;
  }

  async create(data: {
    name: string;
    categoryId: number;
    imageUrl: string;
    price: string | null;
    specifications: Record<string, string>;
  }): Promise<ProductRow> {
    await this.assertCategoryExists(data.categoryId);

    return this.repository.create(data);
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
    await this.getById(id);

    if (data.categoryId !== undefined) {
      await this.assertCategoryExists(data.categoryId);
    }

    return this.repository.update(id, data);
  }

  async remove(id: number): Promise<{ id: number }> {
    await this.getById(id);

    const removed = await this.repository.remove(id);

    return { id: removed.id };
  }

  /**
   * VALIDATION_FAILED, а не NOT_FOUND: не найден не создаваемый объект, а
   * ссылка во входных данных. То же решение, что в CategoriesService.
   */
  private async assertCategoryExists(categoryId: number): Promise<void> {
    const category = await this.repository.getCategoryPath(categoryId);

    if (!category) {
      throw new AppException(AppError.VALIDATION_FAILED, `Категория ${categoryId} не найдена`);
    }
  }
}
