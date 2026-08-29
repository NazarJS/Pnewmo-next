import {
  defaultShouldDehydrateQuery,
  isServer,
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';

interface TsRestError {
  status: number;
  body: Record<string, unknown>;
  headers: Headers;
}


function isTsRestError(error: unknown): error is TsRestError {
  return typeof error === 'object' && error !== null && 'status' in error && 'headers' in error;
}




function reportApiError(error: unknown): void {
  if (isServer) {
    return;
  }

  if (!isTsRestError(error)) {
    console.error('[api] неожиданная ошибка', error);

    return;
  }

  if (error.status === 401) {
    return;
  }

  const message = typeof error.body.message === 'string' ? error.body.message : 'Произошла ошибка';

  console.error(`[api] ${error.status}: ${message}`);
}



export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          !(isTsRestError(error) && error.status < 500) && failureCount < 1,
      },
      dehydrate: {
        // Только defaultShouldDehydrateQuery (успешные запросы). Вариант с
        // `|| query.state.status === 'pending'` (потоковая SSR-гидрация
        // незавершённых запросов) здесь не подходит: при вложенных
        // HydrationBoundary внешняя граница дегидратирует товары ещё
        // pending-запросом, кладёт его в кэш как pending с промисом, а
        // внутренняя граница, найдя запись уже существующей, гидрирует
        // свежий success через useEffect — который на сервере не
        // выполняется. Итог — HTML с "Загрузка...", который на сервере уже
        // нечем исправить. Ни один потребитель в проекте на потоковую
        // дегидратацию не рассчитан, а её единственный наблюдаемый эффект
        // здесь — порча SSR.
        shouldDehydrateQuery: defaultShouldDehydrateQuery,

        shouldRedactErrors: () => false,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        reportApiError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.options.onError) {
          return;
        }

        reportApiError(error);
      },
    }),
  });
}