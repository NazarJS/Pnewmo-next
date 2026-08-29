import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TsRestModule } from '@ts-rest/nest';

import { CategoriesModule } from './categories/categories.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // validateResponses выключено по умолчанию. Включаем: нарушение контракта на
    // ответе — баг сервера, и 500 с внятным сообщением честнее, чем 200 с
    // неправильным телом, уехавшее клиенту.
    TsRestModule.register({ validateResponses: true }),
    PrismaModule,
    HealthModule,
    CategoriesModule,
    ProductsModule,
  ],
})
export class AppModule {}
