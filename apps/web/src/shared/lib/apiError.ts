import type { AppErrorBody } from '@pnewmo/api-contract';

/**
 * Единая классификация ошибок API — общая для витрины (каталог, товар) и форм
 * админки. Раньше «что это за ошибка и какой текст показать» было продублировано:
 * страница товара сама решала throw/notFound по статусу, а
 * features/catalog-admin/lib/describeServerError.ts параллельно разбирал тело
 * ответа для форм. Здесь одно место, оба потребителя ссылаются на него.
 *
 * Форма входа — то, что реально прилетает из ts-rest (см. shared/api/client.ts,
 * shared/api/tsr.ts). При не-2xx ответе apiFetcher бросает исходный ответ целиком
 * — {status, body, headers} — а не оборачивает его (см.
 * @ts-rest/react-query/v5/internal/create-hooks.cjs.js, apiFetcher: `if
 * (core.isErrorResponse(result)) throw result;`). Прямой клиент (api.*, без
 * react-query) для non-2xx вообще не бросает — отдаёт тот же {status, body,
 * headers} как обычный return. Сетевой сбой (сервер недоступен, DNS, CORS) —
 * другое дело: fetch() бросает ДО того, как ts-rest успевает что-то обернуть,
 * и наружу выходит обычный Error без status и body. Функция принимает оба вида
 * значения одинаково: и то, что вернул клиент напрямую, и то, что react-query
 * положил в state.error после throw.
 */
export const SERVER_FAILURE_MESSAGE = 'Проблемы на сервере, попробуйте ещё раз';

export type ApiErrorKind = 'server' | 'notFound' | 'clientError';

export interface ApiErrorClassification {
  /**
   * server — 5xx или сеть недоступна: вызывающая сторона обязана бросить
   * дальше, чтобы страница честно ответила 500 (правило заказчика №1).
   * notFound — 404: вызывающая сторона зовёт notFound() там, где это уместно.
   * clientError — всё остальное (в первую очередь 400 валидации): текст от
   * API показывается как есть, без подмены на 404 или 500 (правило №2).
   */
  kind: ApiErrorKind;
  /**
   * Текст для показа человеку. Для kind 'server' — фиксированная фраза, а не
   * error.message: у сетевого сбоя message — техническое 'fetch failed' /
   * 'Failed to fetch' (проверено вживую, см. описание в старом
   * describeServerError), у 5xx с телом — message может содержать
   * подробности, которые посетителю витрины показывать незачем. Для
   * 'notFound' и 'clientError' — сообщение, которое прислал API (см.
   * app-exception.filter.ts на бэкенде — тексты уже человекочитаемые и
   * по-русски).
   */
  message: string;
}

const FALLBACK_MESSAGE = 'Ошибка сохранения';

interface ApiErrorResponseLike {
  status: number;
  body?: unknown;
}

/**
 * Отличает «ответ сервера с кодом статуса» от голого Error сетевого сбоя.
 * Проверяем именно status, а не body: у ответа он есть всегда (даже когда
 * тело не распарсилось в AppErrorBody, например HTML-страница ошибки от
 * промежуточного прокси), а у Error — никогда.
 */
function isApiErrorResponse(error: unknown): error is ApiErrorResponseLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

function isAppErrorBody(body: unknown): body is AppErrorBody {
  return typeof body === 'object' && body !== null && 'message' in body;
}

/**
 * Порядок ветвей и сам текст — как было в исходном describeServerError:
 * issues (с путём поля, иначе сообщения о разных полях неотличимы) в
 * приоритете, message — запасной вариант. Задача не просила менять разбор
 * 400 — только унифицировать источник, поэтому логика перенесена дословно.
 */
function describeBody(body: unknown): string {
  if (!isAppErrorBody(body)) {
    return FALLBACK_MESSAGE;
  }

  const { message, issues } = body;

  if (Array.isArray(issues) && issues.length > 0) {
    return issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
  }

  return message ?? FALLBACK_MESSAGE;
}

export function classifyApiError(error: unknown): ApiErrorClassification {
  if (!isApiErrorResponse(error)) {
    return { kind: 'server', message: SERVER_FAILURE_MESSAGE };
  }

  if (error.status === 404) {
    return { kind: 'notFound', message: describeBody(error.body) };
  }

  if (error.status >= 500) {
    return { kind: 'server', message: SERVER_FAILURE_MESSAGE };
  }

  return { kind: 'clientError', message: describeBody(error.body) };
}
