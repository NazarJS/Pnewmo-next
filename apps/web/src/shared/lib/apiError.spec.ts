import { classifyApiError, SERVER_FAILURE_MESSAGE } from './apiError';

/**
 * Форма входа взята из реального поведения ts-rest (см. комментарий в
 * apiError.ts): при не-2xx ответе бросается исходный {status, body, headers}
 * целиком, а при сетевом сбое — обычный Error без этих полей. Тесты этот
 * контракт и проверяют, не заглядывая в реализацию классификатора.
 */
function httpError(status: number, body: unknown): { status: number; body: unknown; headers: Headers } {
  return { status, body, headers: new Headers() };
}

describe('classifyApiError', () => {
  it('5xx — сбой сервера, текст фиксированный', () => {
    const error = httpError(500, { errorCode: 'INTERNAL', message: 'Внутренняя ошибка сервера' });

    expect(classifyApiError(error)).toEqual({ kind: 'server', message: SERVER_FAILURE_MESSAGE });
  });

  it('502 от прокси — тоже сбой сервера', () => {
    const error = httpError(502, undefined);

    expect(classifyApiError(error)).toEqual({ kind: 'server', message: SERVER_FAILURE_MESSAGE });
  });

  /**
   * Сетевой сбой — обычный Error без status и body: ts-rest не оборачивает
   * ECONNREFUSED/DNS/CORS в объект ответа (см. apiFetcher в
   * @ts-rest/react-query). Голый Error() отличить от осмысленного ответа
   * можно только по отсутствию этих полей.
   */
  it('сетевой сбой (голый Error) — тоже сбой сервера', () => {
    const error = new Error('fetch failed');

    expect(classifyApiError(error)).toEqual({ kind: 'server', message: SERVER_FAILURE_MESSAGE });
  });

  it('400 с issues — текст собирается из issues, а не из message', () => {
    const error = httpError(400, {
      errorCode: 'VALIDATION_FAILED',
      message: 'Некорректные данные запроса',
      issues: [
        { path: 'limit', message: 'Значение должно быть не больше 100' },
        { path: 'offset', message: 'Значение должно быть не меньше 0' },
      ],
    });

    expect(classifyApiError(error)).toEqual({
      kind: 'clientError',
      message: 'limit: Значение должно быть не больше 100; offset: Значение должно быть не меньше 0',
    });
  });

  it('400 без issues — текст берётся из message как есть', () => {
    const error = httpError(400, { errorCode: 'CONFLICT', message: 'Слаг уже занят' });

    expect(classifyApiError(error)).toEqual({ kind: 'clientError', message: 'Слаг уже занят' });
  });

  it('404 — отдельный вид, а не clientError и не server', () => {
    const error = httpError(404, { errorCode: 'NOT_FOUND', message: 'Запись не найдена' });

    expect(classifyApiError(error)).toEqual({ kind: 'notFound', message: 'Запись не найдена' });
  });
});
