'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { CATEGORY_LIST_QUERY_KEY } from '@/entities/category/lib/queryKey';
import { useCategories } from '@/entities/category/api/hook';
import { tsr } from '@/shared/api/tsr';

import { revalidateCatalog } from '../api/revalidate';
import { describeServerError } from '../lib/describeServerError';
import styles from './AdminForms.module.scss';

interface CategoryFormValues {
  name: string;
  slug: string;
  parentId: string;
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
