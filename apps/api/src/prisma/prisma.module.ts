import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Глобальный по той же причине, по которой глобален TypeOrmModule.forRoot():
 * соединение с базой — инфраструктура на всё приложение. Репозитории при этом
 * остаются явными в своих модулях.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
