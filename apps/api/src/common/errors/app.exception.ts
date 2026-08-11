import { AppError } from './app-error.enum';

/**
 * Доменное исключение. Наследует Error, а не HttpException, намеренно: сервис
 * не знает про HTTP-статусы, их назначает AppExceptionFilter. Это та же
 * граница, что «нет бизнес-логики в контроллере», но с обратной стороны —
 * нет HTTP в домене.
 */
export class AppException extends Error {
  constructor(
    readonly code: AppError,
    message: string,
  ) {
    super(message);
    this.name = 'AppException';
  }
}
