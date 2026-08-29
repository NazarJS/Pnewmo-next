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

const CategoryForm = () => {
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const { register, handleSubmit, reset, formState } = useForm<CategoryFormValues>({
    defaultValues: { name: '', slug: '', parentId: '' },
  });

  const mutation = tsr.categories.create.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORY_LIST_QUERY_KEY });
      await revalidateCatalog();
      reset();
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

  // Ошибку показываем ту, что пришла с сервера. Правило слага живёт в
  // контракте вместе с текстом («Допустимы только строчные латинские буквы,
  // цифры, дефис и подчёркивание») — дублировать его на клиенте значит завести
  // второй источник правды, который разойдётся с первым.
  //
  // Верхнеуровневое message при провале валидации — общая фраза «Некорректные
  // данные запроса» (AppExceptionFilter.describe): текст конкретного правила
  // лежит в issues[].message. Поэтому issues проверяется первым, а
  // message — это запасной вариант для ошибок без issues (например 409).
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
      <h2>Новая категория</h2>

      <label className={styles.field}>
        Название
        <input {...register('name', { required: true })} />
      </label>

      <label className={styles.field}>
        Слаг
        <input {...register('slug', { required: true })} />
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

      <button type="submit" disabled={formState.isSubmitting || mutation.isPending}>
        Создать
      </button>

      {serverMessage && <p className={styles.error}>{serverMessage}</p>}
      {mutation.isSuccess && <p className={styles.ok}>Категория создана</p>}
    </form>
  );
};

export default CategoryForm;
