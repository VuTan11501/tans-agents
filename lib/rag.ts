import { searchCollectionLocal, type RagSource } from "@/lib/collections"

export type RagSearchResult = {
  chunk: string
  score: number
  source: RagSource
}

export async function searchRagCollection({
  query,
  collectionId,
  topK = 5,
}: {
  query: string
  collectionId: string
  topK?: number
}): Promise<RagSearchResult[]> {
  const results = await searchCollectionLocal({ query, collectionId, topK })
  return results.map((result) => ({
    chunk: result.chunk,
    score: result.score,
    source: result.sourceMeta,
  }))
}
