import { RagError } from "./contracts";
const stop = new Set(
  "a an the and or to of in on for is are was were be been with by as at from it this that these those what which how why does do did can could would should explain describe paper according using used use".split(
    " ",
  ),
);
export function tokens(text: string): string[] {
  return (
    text
      .replace(/([\p{L}])-\s+([\p{L}])/gu, "$1$2")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((t) => !stop.has(t));
}
export interface Ranked {
  id: string;
  score: number;
}
export interface SearchDocument {
  id: string;
  text: string;
}
function counts(text: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const term of tokens(text))
    result.set(term, (result.get(term) ?? 0) + 1);
  return result;
}
export function sortRanked(values: Ranked[]): Ranked[] {
  return values.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function bm25(
  documents: SearchDocument[],
  query: string,
  k1 = 1.2,
  b = 0.75,
): Ranked[] {
  if (!Number.isFinite(k1) || k1 <= 0 || !Number.isFinite(b) || b < 0 || b > 1)
    throw new RagError(
      "configuration",
      "BM25 requires k1 > 0 and 0 <= b <= 1.",
    );
  const docs = documents.map((d) => ({
    ...d,
    counts: counts(d.text),
    length: tokens(d.text).length,
  }));
  const average =
    docs.reduce((sum, d) => sum + d.length, 0) / (docs.length || 1) || 1;
  const queryTerms = [...new Set(tokens(query))];
  const frequencies = new Map(
    queryTerms.map((term) => [
      term,
      docs.filter((d) => d.counts.has(term)).length,
    ]),
  );
  return sortRanked(
    docs
      .map((d) => ({
        id: d.id,
        score: queryTerms.reduce((sum, term) => {
          const tf = d.counts.get(term) ?? 0;
          const df = frequencies.get(term) ?? 0;
          const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
          return (
            sum +
            (idf * tf * (k1 + 1)) /
              (tf + k1 * (1 - b + (b * d.length) / average))
          );
        }, 0),
      }))
      .filter((d) => d.score > 0),
  );
}
export function tfidf(documents: SearchDocument[], query: string): Ranked[] {
  const docs = documents.map((d) => ({ id: d.id, counts: counts(d.text) }));
  const df = new Map<string, number>();
  for (const d of docs)
    for (const term of d.counts.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const weight = (term: string, tf: number) =>
    (1 + Math.log(tf)) *
    (Math.log((docs.length + 1) / ((df.get(term) ?? 0) + 1)) + 1);
  const q = new Map(
    [...counts(query)].map(([term, count]) => [term, weight(term, count)]),
  );
  const qnorm = Math.hypot(...q.values());
  return sortRanked(
    docs
      .map((d) => {
        let dot = 0,
          norm2 = 0;
        for (const [term, count] of d.counts) {
          const w = weight(term, count);
          norm2 += w * w;
          dot += w * (q.get(term) ?? 0);
        }
        return {
          id: d.id,
          score: qnorm && norm2 ? dot / (Math.sqrt(norm2) * qnorm) : 0,
        };
      })
      .filter((d) => d.score > 0),
  );
}
export function cosine(a: number[], b: number[]): number {
  if (
    a.length !== b.length ||
    !a.length ||
    a.some((n) => !Number.isFinite(n)) ||
    b.some((n) => !Number.isFinite(n))
  )
    throw new RagError("validation", "Incompatible vectors.");
  const anorm = Math.hypot(...a),
    bnorm = Math.hypot(...b);
  return anorm && bnorm
    ? a.reduce((sum, n, i) => sum + n * (b[i] ?? 0), 0) / (anorm * bnorm)
    : 0;
}
export function rrf(rankings: Ranked[][], constant = 60): Ranked[] {
  if (!Number.isFinite(constant) || constant < 0)
    throw new RagError("configuration", "Invalid RRF constant.");
  const result = new Map<string, number>();
  for (const ranking of rankings) {
    const seen = new Set<string>();
    for (const [i, item] of ranking.entries()) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.set(item.id, (result.get(item.id) ?? 0) + 1 / (constant + i + 1));
    }
  }
  return sortRanked([...result].map(([id, score]) => ({ id, score })));
}
