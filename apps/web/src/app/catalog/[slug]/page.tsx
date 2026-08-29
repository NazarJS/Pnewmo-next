import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { prefetchProductList } from '@/entities/product/api/productPrefetch';
import { DEFAULT_PAGE, PRODUCTS_PER_PAGE } from '@/entities/product/lib/constants';
import { buildProductListQueryKey } from '@/entities/product/lib/queryKey';
import { api } from '@/shared/api/client';
import { tsr } from '@/shared/api/tsr';
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

  const productListData = tsr
    .initQueryClient(queryClient)
    .products.list.getQueryData(buildProductListQueryKey({ categoryId: category.id, offset, limit }));

  const total = productListData?.status === 200 ? productListData.body.total : 0;

  // Страница за пределами диапазона (например ?page=999 при 202 реальных) —
  // 404, а не пустая сетка с «Назад» в никуда: адрес достижим кривой
  // ссылкой, и без этой проверки бот проиндексирует мусорную страницу как
  // рабочую. page=1 не трогаем: пустая категория на первой странице —
  // законное состояние (см. ProductGrid), не ошибка пагинации.
  if (offset > 0 && offset >= total) {
    notFound();
  }

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
