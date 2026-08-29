'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { useCategories } from '@/entities/category/api/hook';
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

const ProductForm = () => {
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const { register, handleSubmit, reset, formState } = useForm<ProductFormValues>({
    defaultValues: { name: '', categoryId: '', imageUrl: '', price: '', specifications: '' },
  });

  const mutation = tsr.products.create.useMutation({
    onSuccess: async () => {
      // Префикс, а не точный ключ: список товаров закэширован под каждую
      // комбинацию категории и страницы, и какая из них затронута — неизвестно.
      await queryClient.invalidateQueries({ queryKey: ['product-list'] });
      await revalidateCatalog();
      reset();
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

  // Верхнеуровневое message при провале валидации — общая фраза «Некорректные
  // данные запроса» (AppExceptionFilter.describe): текст конкретного правила,
  // например про формат цены, лежит в issues[].message.
  const serverMessage =
    mutation.error &&
    'body' in mutation.error &&
    typeof mutation.error.body === 'object' &&
    mutation.error.body !== null
      ? String(
          (mutation.error.body as { issues?: Array<{ message?: unknown }> }).issues?.[0]?.message ??
            (mutation.error.body as { message?: unknown }).message ??
            'Ошибка сохранения',
        )
      : null;

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <h2>Новый товар</h2>

      <label className={styles.field}>
        Название
        <input {...register('name', { required: true })} />
      </label>

      <label className={styles.field}>
        Категория
        <select {...register('categoryId', { required: true })}>
          <option value="">— выберите —</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {'— '.repeat(category.path.split('.').length - 1)}
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        Ссылка на картинку
        <input {...register('imageUrl', { required: true })} />
      </label>

      <label className={styles.field}>
        Цена
        <input {...register('price')} placeholder="21493.96" />
      </label>

      <label className={styles.field}>
        Характеристики, по одной в строке «ключ: значение»
        <textarea rows={5} {...register('specifications')} placeholder={'Диаметр поршня, мм: 63\nХод, мм: 125'} />
      </label>

      <button type="submit" disabled={formState.isSubmitting || mutation.isPending}>
        Создать
      </button>

      {serverMessage && <p className={styles.error}>{serverMessage}</p>}
      {mutation.isSuccess && <p className={styles.ok}>Товар создан</p>}
    </form>
  );
};

export default ProductForm;
