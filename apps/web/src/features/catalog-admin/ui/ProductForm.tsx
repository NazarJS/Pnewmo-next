'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { useCategories } from '@/entities/category/api/hook';
import { PRODUCT_LIST_QUERY_KEY_PREFIX } from '@/entities/product/lib/queryKey';
import { tsr } from '@/shared/api/tsr';
import { isAllowedProductImageUrl, PRODUCT_IMAGE_URL_PREFIX } from '@/shared/config/productImage';

import { revalidateCatalog } from '../api/revalidate';
import { describeServerError } from '../lib/describeServerError';
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
        <input
          {...register('imageUrl', {
            required: 'Обязательное поле',
            // next/image (и в деве, и в проде) отдаёт исключение на рендере
            // карточки, если хост не прописан в images.remotePatterns, а
            // сетка рендерится и на сервере — один такой товар роняет всю
            // страницу категории. Проверяем на вводе тем же правилом, что и
            // remotePatterns (см. shared/config/productImage.ts), чтобы
            // форма не могла завести товар, ломающий рендер.
            validate: (value) => isAllowedProductImageUrl(value) || `Ссылка должна начинаться с ${PRODUCT_IMAGE_URL_PREFIX}`,
          })}
          aria-invalid={!!errors.imageUrl}
        />
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
