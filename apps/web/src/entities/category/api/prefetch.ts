import type { QueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/client';

import { CATEGORY_LIST_QUERY_KEY } from '../lib/queryKey';

/**
 * Серверный префетч. НЕ реэкспортируется из барреля: попав в клиентский бандл
 * через баррель, серверный код тянет за собой зависимости, которые в браузере
 * не работают, и ломается не на сборке, а в рантайме.
 *
 * Ключ и форма ответа обязаны совпадать с useCategories до последнего поля:
 * под этим ключом клиент будет искать готовые данные, а несовпадение обернётся
 * молчаливым повторным запросом при гидрации.
 */
export async function prefetchCategories(queryClient: QueryClient): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: CATEGORY_LIST_QUERY_KEY,
    queryFn: () => api.categories.list(),
  });
}
