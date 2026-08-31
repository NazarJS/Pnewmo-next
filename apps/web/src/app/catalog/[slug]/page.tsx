import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { fetchCategoryList } from '@/entities/category/api/prefetch';
import { getProductListError, prefetchProductList } from '@/entities/product/api/prefetch';
import { parseCatalogUrlState, toSearchParamsGetter } from '@/entities/product/lib/parseCatalogUrlState';
import { buildProductListQueryKey } from '@/entities/product/lib/queryKey';
import { tsr } from '@/shared/api/tsr';
import { getQueryClient } from '@/shared/lib/getQueryClient';
import ProductGrid from '@/widgets/product-grid/ProductGrid';

import styles from './Catalog.module.scss';

interface CatalogPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;

  // Та же композиция, что и клиентский useCatalogUrlState — единственный
  // parseCatalogUrlState на обе стороны (см. entities/product/lib/
  // parseCatalogUrlState.ts). toSearchParamsGetter адаптирует Record,
  // которым Next отдаёт searchParams серверному компоненту, под
  // Pick<URLSearchParams, 'get'>, который эта функция уже принимает.
  const { limit, offset } = parseCatalogUrlState(toSearchParamsGetter(rawSearchParams));

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
  const filter = { categoryId: category.id, offset, limit };

  await prefetchProductList(queryClient, filter);

  const productListError = getProductListError(queryClient, filter);

  if (productListError && productListError.kind !== 'clientError') {
    // 5xx или сеть недоступна — честный 500 через границу ошибок
    // (app/error.tsx), а не «Загрузка...» на 200 (правило заказчика №1).
    // notFound() здесь неприменим: категория уже найдена и существует, сбой
    // — в ручке товаров, а не в адресе.
    throw new Error(productListError.message);
  }

  const productListData = tsr
    .initQueryClient(queryClient)
    .products.list.getQueryData(buildProductListQueryKey(filter));

  // 404 — только при подтверждённом success с total меньше offset. При
  // productListError с kind 'clientError' (400 — контракт отверг offset/limit)
  // страница остаётся на месте и показывает текст ошибки ниже, а не 404
  // (правило №2): productListData в этом случае и так не станет success, но
  // проверка написана явно — так инвариант виден в самом коде, а не только
  // в поведении react-query.
  if (
    !productListError &&
    offset > 0 &&
    productListData?.status === 200 &&
    offset >= productListData.body.total
  ) {
    notFound();
  }

  return (
    <div className={styles.container_page}>
      <section className={styles.section}>
        <h1 className={styles.name}>{category.name}</h1>

        {productListError ? (
          <p>{productListError.message}</p>
        ) : (
          <HydrationBoundary state={dehydrate(queryClient)}>
            {/* page/offset/limit ProductGrid больше не принимает пропами — он
                читает их через useCatalogUrlState, тем же parseCatalogUrlState,
                которым выше пользуется эта страница. categoryId остаётся
                пропом: слаг лежит в пути, но резолвить его в id категории
                на клиенте заново незачем — он уже есть здесь. */}
            <ProductGrid categoryId={category.id} />
          </HydrationBoundary>
        )}
      </section>
    </div>
  );
}
