import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { fetchCategoryList } from '@/entities/category/api/prefetch';
import { prefetchProductList } from '@/entities/product/api/productPrefetch';
import { DEFAULT_PAGE, PRODUCTS_PER_PAGE } from '@/entities/product/lib/constants';
import { buildProductListQueryKey } from '@/entities/product/lib/queryKey';
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

  // Тот же кешированный вызов, что у RootLayout (fetchCategoryList), а не свой
  // api.categories.list(): раньше страница каталога обходила и кеш, и тег
  // сброса — см. комментарий в entities/category/api/prefetch.ts.
  const categoriesResponse = await fetchCategoryList();

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

  // 404 — только при подтверждённом success с total меньше offset. Пустой
  // кэш (productListData === undefined) значит либо то же самое «страница
  // за диапазоном», либо что prefetchProductList вычистил упавший запрос
  // (см. productPrefetch.ts) — отличить одно от другого без доступа к
  // ошибке нечем, поэтому при отсутствии success-ответа страница не
  // объявляется 404: рендерится как обычно, а клиент может повторить запрос.
  if (offset > 0 && productListData?.status === 200 && offset >= productListData.body.total) {
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
