'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { useCategories } from '@/entities/category/api/hook';
import { PRODUCT_LIST_QUERY_KEY_PREFIX } from '@/entities/product/lib/queryKey';
import { tsr } from '@/shared/api/tsr';

import { revalidateCatalog } from '../api/revalidate';
import styles from './AdminForms.module.scss';

interface ProductFormValues {
  name: string;
  categoryId: string;
  imageUrl: string;
  price: string;
  specifications: string;
}

/**
 * Характеристики вводятся построчно, «ключ: значение» — минимальный интерфейс
 * под временную админку. Строки без двоеточия молча пропускаются: падать на
 * опечатке в необязательном поле хуже, чем её проигнорировать.
 */
function parseSpecifications(raw: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const separator = line.indexOf(':');

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (key !== '' && value !== '') {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Верхнеуровневое message при провале валидации — общая фраза «Некорректные
 * данные запроса» (AppExceptionFilter.describe): текст конкретного правила,
 * например про формат цены, лежит в issues[].message, а имя поля — в
 * issues[].path. У формы товара пять полей, и без пути сообщение про цену
 * неотличимо от сообщения про что угодно другое.
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

const ProductForm = () => {
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    defaultValues: { name: '', categoryId: '', imageUrl: '', price: '', specifications: '' },
  });

  const mutation = tsr.products.create.useMutation({
    onSuccess: async () => {
      // Префикс, а не точный ключ: список товаров закэширован под каждую
      // комбинацию категории и страницы, и какая из них затронута — неизвестно.
      await queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY_PREFIX] });
      reset();

      try {
        // Отдельный try/catch: сбой сброса кеша (например, протухший id Server
        // Action после HMR в деве) не должен превращать уже успешную мутацию в
        // ошибку — запись в базе уже есть, откатывать её не нужно.
        await revalidateCatalog();
      } catch (error) {
        console.error('Не удалось сбросить кеш каталога после создания товара', error);
      }
    },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate({
      body: {
        name: values.name,
        categoryId: Number(values.categoryId),
        imageUrl: values.imageUrl,
        price: values.price === '' ? null : values.price,
        specifications: parseSpecifications(values.specifications),
      },
    });
  });

  const serverMessage = describeServerError(mutation.error);

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <h2>Новый товар</h2>

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
        Категория
        <select {...register('categoryId', { required: 'Обязательное поле' })} aria-invalid={!!errors.categoryId}>
          <option value="">— выберите —</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {'— '.repeat(category.path.split('.').length - 1)}
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <span className={styles.error} role="alert">
            {errors.categoryId.message}
          </span>
        )}
      </label>

      <label className={styles.field}>
        Ссылка на картинку
        <input {...register('imageUrl', { required: 'Обязательное поле' })} aria-invalid={!!errors.imageUrl} />
        {errors.imageUrl && (
          <span className={styles.error} role="alert">
            {errors.imageUrl.message}
          </span>
        )}
      </label>

      <label className={styles.field}>
        Цена
        <input {...register('price')} placeholder="21493.96" />
      </label>

      <label className={styles.field}>
        Характеристики, по одной в строке «ключ: значение»
        <textarea rows={5} {...register('specifications')} placeholder={'Диаметр поршня, мм: 63\nХод, мм: 125'} />
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
          Товар создан
        </p>
      )}
    </form>
  );
};

export default ProductForm;
