import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { AppErrorBody } from '@pnewmo/api-contract';
import type { Response } from 'express';

import { AppError } from '../errors/app-error.enum';
import { AppException } from '../errors/app.exception';
import {
  appErrorByPrismaCode,
  appErrorByStatus,
  extractTsRestIssues,
  statusByAppError,
} from '../errors/error-mapping';

interface PrismaKnownError {
  code: string;
  message: string;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return typeof error.code === 'string' && error.code.startsWith('P');
}

/**
 * Единственная точка, где ошибка превращается в HTTP-ответ. Отдаёт всегда одну
 * форму тела (appErrorSchema), чтобы клиент не разбирал несколько форматов.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.describe(exception);

    response.status(status).json(body);
  }

  private describe(exception: unknown): { status: number; body: AppErrorBody } {
    if (exception instanceof AppException) {
      return {
        status: statusByAppError[exception.code],
        body: { errorCode: exception.code, message: exception.message },
      };
    }

    if (isPrismaKnownError(exception)) {
      const code = appErrorByPrismaCode(exception.code);

      if (code) {
        return {
          status: statusByAppError[code],
          body: { errorCode: code, message: prismaMessage(exception.code) },
        };
      }

      this.logger.error(`Необработанная ошибка Prisma ${exception.code}`, exception.message);

      return {
        status: 500,
        body: { errorCode: AppError.INTERNAL, message: 'Внутренняя ошибка сервера' },
      };
    }

    if (exception instanceof HttpException) {
      const issues = extractTsRestIssues(exception.getResponse());

      if (issues) {
        return {
          status: 400,
          body: {
            errorCode: AppError.VALIDATION_FAILED,
            message: 'Некорректные данные запроса',
            issues,
          },
        };
      }

      const status = exception.getStatus();

      return {
        status,
        body: { errorCode: appErrorByStatus(status), message: exception.message },
      };
    }

    this.logger.error(
      'Необработанное исключение',
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      status: 500,
      body: { errorCode: AppError.INTERNAL, message: 'Внутренняя ошибка сервера' },
    };
  }
}

/**
 * Наружу уходит только своё сообщение, никогда текст от Prisma: в нём
 * встречаются имена таблиц и фрагменты схемы.
 */
function prismaMessage(code: string): string {
  switch (code) {
    case 'P2002':
      return 'Запись с таким значением уже существует';
    case 'P2003':
      return 'Нельзя выполнить операцию: на запись ссылаются другие данные';
    case 'P2025':
      return 'Запись не найдена';
    default:
      return 'Внутренняя ошибка сервера';
  }
}
