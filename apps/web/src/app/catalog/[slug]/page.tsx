import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { prefetchProductList } from '@/entities/product/api/productPrefetch';
import { DEFAULT_PAGE, PRODUCTS_PER_PAGE } from '@/entities/product/lib/constants';
import { api } from '@/shared/api/client';
import { getQueryClient } from '@/shared/lib/getQueryClient';
import { readNumberParam, resolveLimit, resolvePage, toOffset } from '@/shared/lib/pagination';
import ProductGrid from '@/widgets/product-grid/ProductGrid';

import styles from './Catalog.module.scss';

interface CatalogPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;

  const page = resolvePage(readNumberParam(rawSearchParams.page), DEFAULT_PAGE);
  const limit = resolveLimit(readNumberParam(rawSearchParams.limit), PRODUCTS_PER_PAGE);
  const offset = toOffset(page, limit);

  const categoriesResponse = await api.categories.list();

  if (categoriesResponse.status !== 200) {
    throw new Error('Не удалось загрузить категории');
  }

  const category = categoriesResponse.body.find((item) => item.slug === slug);

  // notFound(), а не «Категория не найдена» в разметке: несуществующая
  // категория обязана отдавать 404, иначе поисковик проиндексирует её как
  // рабочую страницу.
  if (!category) {
    notFound();
  }

  const queryClient = getQueryClient();

  await prefetchProductList(queryClient, { categoryId: category.id, offset, limit });

  return (
    <div className={styles.container_page}>
      <section className={styles.section}>
        <h1 className={styles.name}>{category.name}</h1>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <ProductGrid categoryId={category.id} page={page} offset={offset} limit={limit} />
        </HydrationBoundary>
      </section>
    </div>
  );
}
