import { Injectable } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.enum';
import { AppException } from '../common/errors/app.exception';
import { CategoriesRepository, CategoryRow } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  getList(): Promise<CategoryRow[]> {
    return this.repository.getList();
  }

  async getById(id: number): Promise<CategoryRow> {
    const category = await this.repository.getById(id);

    if (!category) {
      throw new AppException(AppError.NOT_FOUND, `Категория ${id} не найдена`);
    }

    return category;
  }

  async create(data: {
    name: string;
    slug: string;
    parentId: number | null;
  }): Promise<CategoryRow> {
    await this.assertParentExists(data.parentId);

    return this.repository.create(data);
  }

  async update(
    id: number,
    data: { name?: string; slug?: string; parentId?: number | null },
  ): Promise<CategoryRow> {
    const category = await this.getById(id);

    if (data.parentId !== undefined) {
      await this.assertParentExists(data.parentId);
      await this.assertNoCycle(id, data.parentId);

      // Пересчёт path поддерева сознательно отложен (следующие этапы). Без
      // него смена родителя прошла бы молча: репозиторий обновил бы parentId,
      // а path категории и всего её поддерева остался бы от старого родителя —
      // выборка товаров по поддереву (WHERE path LIKE 'x.%') тогда тихо врёт,
      // без единой ошибки в логах. Запрещаем явным отказом, а не тихим
      // пропуском, до тех пор пока пересчёт не реализован.
      if (data.parentId !== category.parentId) {
        throw new AppException(
          AppError.CONFLICT,
          'Перемещение категории между родителями пока не поддерживается: путь поддерева не пересчитывается',
        );
      }
    }

    return this.repository.update(id, data);
  }

  async remove(id: number): Promise<{ id: number }> {
    await this.getById(id);

    // Проверка здесь, а не только через onDelete: Restrict, ради внятного
    // сообщения: фильтр маппит ошибку внешнего ключа по коду Prisma и про домен
    // ничего не знает, поэтому выдал бы «на запись ссылаются другие данные».
    // Ограничение в базе при этом остаётся страховкой от гонки.
    const children = await this.repository.countChildren(id);

    if (children > 0) {
      throw new AppException(
        AppError.CONFLICT,
        `Нельзя удалить категорию: у неё ${children} подкатегорий`,
      );
    }

    // Та же логика, что и с подкатегориями: onDelete: Restrict у Product.category
    // и так не даст удалить строку, но сообщение будет про «другие данные»,
    // а не про товары — бесполезно для человека в форме админки.
    const products = await this.repository.countProducts(id);

    if (products > 0) {
      throw new AppException(
        AppError.CONFLICT,
        `Нельзя удалить категорию: в ней ${products} товаров`,
      );
    }

    const removed = await this.repository.remove(id);

    return { id: removed.id };
  }

  /**
   * VALIDATION_FAILED, а не NOT_FOUND: не найден не создаваемый объект, а ссылка
   * во входных данных — это ошибка запроса, а не отсутствие ресурса.
   */
  private async assertParentExists(parentId: number | null | undefined): Promise<void> {
    if (parentId === null || parentId === undefined) {
      return;
    }

    const parent = await this.repository.getById(parentId);

    if (!parent) {
      throw new AppException(
        AppError.VALIDATION_FAILED,
        `Родительская категория ${parentId} не найдена`,
      );
    }
  }

  /**
   * Ни Zod, ни внешний ключ цикл не поймают: форма запроса корректна, и ссылка
   * ведёт на существующую строку. А результат — поддерево, недостижимое из
   * корня, которое исчезает из меню без единой ошибки в логах.
   */
  private async assertNoCycle(id: number, newParentId: number | null): Promise<void> {
    if (newParentId === null) {
      return;
    }

    if (newParentId === id) {
      throw new AppException(
        AppError.VALIDATION_FAILED,
        'Категория не может быть родителем самой себя',
      );
    }

    const visited = new Set<number>();
    let cursor: number | null = newParentId;

    while (cursor !== null) {
      if (cursor === id) {
        throw new AppException(
          AppError.VALIDATION_FAILED,
          'Нельзя переместить категорию в её собственного потомка',
        );
      }

      // Страховка от уже испорченных данных: если цикл каким-то образом попал в
      // базу, обход не должен зависнуть.
      if (visited.has(cursor)) {
        return;
      }

      visited.add(cursor);

      const parent = await this.repository.getParentId(cursor);

      cursor = parent?.parentId ?? null;
    }
  }
}
