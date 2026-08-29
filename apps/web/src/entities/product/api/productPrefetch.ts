import type { QueryClient } from '@tanstack/react-query';

import { tsr } from '@/shared/api/tsr';

import { ProductListFilterState } from '../lib/productTypes';
import { buildProductListQuery, buildProductListQueryKey } from '../lib/queryKey';

/** Тег для сброса из мутаций админки. */
export const PRODUCTS_CACHE_TAG = 'products';

/** Пять минут: каталог правят штучно через админку, а та сбрасывает кеш тегом. */
const REVALIDATE_SECONDS = 300;

/**
 * Серверный префетч. НЕ реэкспортируется из барреля: серверный код, утёкший в
 * клиентский бандл, ломается не на сборке, а в рантайме.
 *
 * Кешируются данные, а не роут. Первоначально предполагалось поставить
 * `export const revalidate` на страницу каталога — это не работает: в Next 16
 * searchParams устроен как «висящий» промис, и первое же его разворачивание
 * помечает доступ динамическим, выбивая страницу из статической оболочки. А
 * пагинация без чтения searchParams невозможна.
 *
 * Поэтому кеш вешается на сам fetch через fetchOptions.next. Проверено по типам
 * @ts-rest/core 3.52.1: аргументы запроса принимают `fetchOptions?: FetchOptions`,
 * а FetchOptions выводится из параметров конструктора Request — который в Next
 * расширен полем `next`. Верхнеуровневый `next` там же помечен deprecated в
 * пользу `fetchOptions.next`.
 *
 * HTML при этом собирается на каждый запрос — боты получают полную разметку, —
 * но база опрашивается раз в пять минут на комбинацию параметров.
 */
export async function prefetchProductList(
  queryClient: QueryClient,
  filter: ProductListFilterState,
): Promise<void> {
  // initQueryClient связывает контракт с переданным QueryClient и кладёт ответ
  // в кэш ровно в той форме, которую ждёт клиентский хук: { status, body,
  // headers }. Собирать это значение руками через setQueryData — верный способ
  // ошибиться в форме и получить молчаливый повторный запрос при гидрации.
  const tsrQC = tsr.initQueryClient(queryClient);

  await tsrQC.products.list.prefetchQuery({
    // Ключ обязан совпадать с ключом useProductList до последнего элемента —
    // под ним клиент будет искать готовые данные. Поэтому оба зовут один билдер.
    queryKey: buildProductListQueryKey(filter),
    queryData: {
      query: buildProductListQuery(filter),
      fetchOptions: { next: { revalidate: REVALIDATE_SECONDS, tags: [PRODUCTS_CACHE_TAG] } },
    },
  });

  // Ошибку в кэше не оставляем: дегидратированное состояние ошибки доедет до
  // клиента и покажет сбой даже там, где повторный запрос прошёл бы успешно.
  // Приём взят из panel-administration, entities/strapi-content/api/prefetch.ts.
  const key = buildProductListQueryKey(filter);

  if (queryClient.getQueryState(key)?.status === 'error') {
    queryClient.removeQueries({ queryKey: key });
  }
}
