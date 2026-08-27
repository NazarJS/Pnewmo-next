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
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',

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