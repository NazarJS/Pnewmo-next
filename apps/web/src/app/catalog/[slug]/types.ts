// См. комментарий в app/types.ts: сиблинг `types.ts` для App Router роутов —
// решение, принятое здесь (в эталоне PageProps в page.tsx остаётся inline).

export interface CatalogPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}
