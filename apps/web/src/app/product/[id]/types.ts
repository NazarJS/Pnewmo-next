// См. комментарий в app/types.ts: сиблинг `types.ts` для App Router роутов —
// решение, принятое здесь (в эталоне PageProps в page.tsx остаётся inline).

export interface ProductPageProps {
  params: Promise<{ id: string }>;
}
