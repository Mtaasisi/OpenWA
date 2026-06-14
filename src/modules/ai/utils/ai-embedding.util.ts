export const EMBEDDING_DIM = 1536;

export function normalizeEmbeddingDim(vector: number[]): number[] {
  if (vector.length === EMBEDDING_DIM) return vector;
  if (vector.length > EMBEDDING_DIM) return vector.slice(0, EMBEDDING_DIM);
  const padded = vector.slice();
  while (padded.length < EMBEDDING_DIM) padded.push(0);
  return padded;
}

export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
