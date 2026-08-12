import { AppError } from './app-error.enum';

export const statusByAppError: Record<AppError, number> = {
  [AppError.NOT_FOUND]: 404,
  [AppError.VALIDATION_FAILED]: 400,
  [AppError.CONFLICT]: 409,
  [AppError.INTERNAL]: 500,
};

/**
 * Известные коды ошибок Prisma. Всё, чего здесь нет, считается внутренней
 * ошибкой: наружу уходит общее сообщение, подробности — в лог.
 */
export function appErrorByPrismaCode(code: string): AppError | null {
  switch (code) {
    case 'P2002':
      return AppError.CONFLICT;
    case 'P2003':
      return AppError.CONFLICT;
    case 'P2025':
      return AppError.NOT_FOUND;
    default:
      return null;
  }
}

export function appErrorByStatus(status: number): AppError {
  switch (status) {
    case 400:
      return AppError.VALIDATION_FAILED;
    case 404:
      return AppError.NOT_FOUND;
    case 409:
      return AppError.CONFLICT;
    default:
      return AppError.INTERNAL;
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * У Zod path — массив сегментов. Приводим только то, что осмысленно приводится:
 * String() на произвольном объекте дал бы «[object Object]» в поле ответа.
 */
function pathToString(path: unknown): string {
  if (Array.isArray(path)) {
    return path
      .filter((segment) => typeof segment === 'string' || typeof segment === 'number')
      .join('.');
  }

  if (typeof path === 'string' || typeof path === 'number') {
    return String(path);
  }

  return '';
}

const RESULT_KEYS = ['paramsResult', 'headersResult', 'queryResult', 'bodyResult'] as const;

/**
 * @ts-rest/nest бросает RequestValidationError extends BadRequestException с
 * телом { paramsResult, headersResult, queryResult, bodyResult }, где каждое
 * поле — либо ошибка Zod, либо null. Сам класс не экспортирован в типах пакета,
 * поэтому распознаём по форме тела: так не зависим ни от неэкспортированного
 * типа, ни от смены его имени.
 *
 * Возвращает null, если тело вообще не похоже на ошибку валидации ts-rest.
 */
export function extractTsRestIssues(body: unknown): ValidationIssue[] | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;

  if (!RESULT_KEYS.some((key) => key in record)) {
    return null;
  }

  const issues: ValidationIssue[] = [];

  for (const key of RESULT_KEYS) {
    const result = record[key];

    if (typeof result !== 'object' || result === null) {
      continue;
    }

    const rawIssues = (result as { issues?: unknown }).issues;

    if (!Array.isArray(rawIssues)) {
      continue;
    }

    for (const raw of rawIssues) {
      const issue = raw as { path?: unknown; message?: unknown };

      issues.push({
        path: pathToString(issue.path),
        message: typeof issue.message === 'string' ? issue.message : 'Некорректное значение',
      });
    }
  }

  return issues;
}
