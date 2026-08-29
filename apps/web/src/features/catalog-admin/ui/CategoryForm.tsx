'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { CATEGORY_LIST_QUERY_KEY } from '@/entities/category/lib/queryKey';
import { useCategories } from '@/entities/category/api/hook';
import { tsr } from '@/shared/api/tsr';

import { revalidateCatalog } from '../api/revalidate';
import styles from './AdminForms.module.scss';

interface CategoryFormValues {
  name: string;
  slug: string;
  parentId: string;
}

/**
 * Ошибку показываем ту, что пришла с сервера. Правило слага живёт в контракте
 * вместе с текстом («Допустимы только строчные латинские буквы, цифры, дефис и
 * подчёркивание») — дублировать его на клиенте значит завести второй источник
 * правды, который разойдётся с первым.
 *
 * Верхнеуровневое message при провале валидации — общая фраза «Некорректные
 * данные запроса» (AppExceptionFilter.describe): текст конкретного правила
 * лежит в issues[].message, а путь поля — в issues[].path. Поэтому issues
 * проверяется первым и с путём, а message — запасной вариант для ошибок без
 * issues (например 409, где message уже конкретное).
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
function describeServerError(error: unknown): string | null {
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

const CategoryForm = () => {
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    defaultValues: { name: '', slug: '', parentId: '' },
  });

  const mutation = tsr.categories.create.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORY_LIST_QUERY_KEY });
      reset();

      try {
        // Отдельный try/catch: сбой сброса кеша (например, протухший id Server
        // Action после HMR в деве) не должен превращать уже успешную мутацию в
        // ошибку — запись в базе уже есть, откатывать её не нужно.
        await revalidateCatalog();
      } catch (error) {
        console.error('Не удалось сбросить кеш каталога после создания категории', error);
      }
    },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate({
      body: {
        name: values.name,
        slug: values.slug,
        parentId: values.parentId === '' ? null : Number(values.parentId),
      },
    });
  });

  const serverMessage = describeServerError(mutation.error);

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <h2>Новая категория</h2>

      <label className={styles.field}>
        Название
        <input {...register('name', { required: 'Обязательное поле' })} aria-invalid={!!errors.name} />
        {errors.name && (
          <span className={styles.error} role="alert">
            {errors.name.message}
          </span>
        )}
      </label>

      <label className={styles.field}>
        Слаг
        <input {...register('slug', { required: 'Обязательное поле' })} aria-invalid={!!errors.slug} />
        {errors.slug && (
          <span className={styles.error} role="alert">
            {errors.slug.message}
          </span>
        )}
      </label>

      <label className={styles.field}>
        Родитель
        <select {...register('parentId')}>
          <option value="">— корневая —</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {'— '.repeat(category.path.split('.').length - 1)}
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" disabled={isSubmitting || mutation.isPending}>
        Создать
      </button>

      {serverMessage && (
        <p className={styles.error} role="alert">
          {serverMessage}
        </p>
      )}
      {mutation.isSuccess && (
        <p className={styles.ok} role="alert">
          Категория создана
        </p>
      )}
    </form>
  );
};

export default CategoryForm;
