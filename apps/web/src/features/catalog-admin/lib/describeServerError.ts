/**
 * Общая для CategoryForm и ProductForm функция: обе формы показывают ошибку
 * мутации одинаково, и раньше это было дословно продублировано в каждой —
 * ~25 строк кода и ~20 строк комментария на файл.
 *
 * Ошибку показываем ту, что пришла с сервера. Правило валидации живёт в
 * контракте вместе с текстом (например, для слага категории — «Допустимы
 * только строчные латинские буквы, цифры, дефис и подчёркивание») —
 * дублировать его на клиенте значит завести второй источник правды, который
 * разойдётся с первым.
 *
 * Верхнеуровневое message при провале валидации — общая фраза «Некорректные
 * данные запроса» (AppExceptionFilter.describe): текст конкретного правила
 * лежит в issues[].message, а путь поля — в issues[].path. У обеих форм
 * несколько полей, и без пути сообщение об одном неотличимо от сообщения о
 * другом. Поэтому issues проверяется первым и с путём, а message — запасной
 * вариант для ошибок без issues (например 409, где message уже конкретное).
 *
 * Третья ветка — для ошибки без тела ответа: ts-rest не оборачивает сетевой
 * сбой (API недоступен, DNS, CORS) в объект с `body`, прилетает обычный
 * `Error`. Без этой ветки форма молчала бы при недоступном сервере.
 *
 * Текст здесь — фиксированная фраза, не `error.message`: проверено вживую —
 * реальный сетевой сбой (ECONNREFUSED) даёт `error.message === 'fetch
 * failed'`, а в браузере то же самое — «Failed to fetch» / «Load failed» в
 * зависимости от движка. Ни то ни другое ничего не говорит пользователю
 * админки.
 */
export function describeServerError(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (typeof error === 'object' && 'body' in error) {
    const body = (error as { body?: unknown }).body;

    if (typeof body === 'object' && body !== null) {
      const { message, issues } = body as {
        message?: unknown;
        issues?: Array<{ path?: unknown; message?: unknown }>;
      };

      if (Array.isArray(issues) && issues.length > 0) {
        return issues.map((issue) => `${String(issue.path)}: ${String(issue.message)}`).join('; ');
      }

      return String(message ?? 'Ошибка сохранения');
    }
  }

  return 'Не удалось связаться с сервером';
}
