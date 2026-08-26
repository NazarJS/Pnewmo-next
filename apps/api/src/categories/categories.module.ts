import { Module } from '@nestjs/common';

import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

/**
 * PrismaModule в imports не нужен — он глобальный. А CategoriesRepository
 * объявлен здесь, а не глобально: соединение с базой — инфраструктура,
 * репозиторий домена — нет.
 */
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
})
export class CategoriesModule {}
