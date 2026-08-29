import type { QueryClient } from '@tanstack/react-query';

import { tsr } from '@/shared/api/tsr';
import { classifyApiError, type ApiErrorClassification } from '@/shared/lib/apiError';
import { CACHE_REVALIDATE_SECONDS } from '@/shared/lib/cacheRevalidateSeconds';

import { ProductListFilterState } from '../lib/productTypes';
import { buildProductListQuery, buildProductListQueryKey } from '../lib/queryKey';

/** Тег для сброса из мутаций админки. */
export const PRODUCTS_CACHE_TAG = 'products';

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
 * но база опрашивается раз в CACHE_REVALIDATE_SECONDS на комбинацию
 * параметров (пять минут вне разработки; см. cacheRevalidateSeconds.ts).
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
      fetchOptions: { next: { revalidate: CACHE_REVALIDATE_SECONDS, tags: [PRODUCTS_CACHE_TAG] } },
    },
  });
}

/**
 * Классифицирует сбой prefetchProductList после того, как он завершился:
 * prefetchQuery не бросает (это его смысл — безопасно звать без try/catch),
 * ошибка молча оседает в состоянии запроса, и без этой функции страница
 * каталога не могла отличить «сбой сервера» от «страница за пределами
 * выдачи» — обе давали одинаковый пустой кэш. Возвращает null при успехе.
 *
 * Ошибку в кэше держим осознанно, хотя раньше её вычищали removeQueries сразу
 * после prefetchQuery: без записи в кэше эта функция ничего не увидит. Это
 * безопасно и для гидрации — shouldDehydrateQuery в queryClient.ts сужен до
 * defaultShouldDehydrateQuery (дегидратируются только успешные запросы, см.
 * комментарий там), так что ошибке всё равно неоткуда попасть в состояние,
 * которое уедет к клиенту.
 */
export function getProductListError(
  queryClient: QueryClient,
  filter: ProductListFilterState,
): ApiErrorClassification | null {
  const state = queryClient.getQueryState(buildProductListQueryKey(filter));

  return state?.status === 'error' ? classifyApiError(state.error) : null;
}
