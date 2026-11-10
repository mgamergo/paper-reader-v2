import { z } from "zod";
export const judgmentSchema = z.object({
  id: z.string(),
  split: z.enum(["dev", "test"]),
  query: z.string(),
  paperId: z.string(),
  page: z.number().int().positive(),
  passage: z.string(),
  expectedAnswer: z.string(),
  answerPatterns: z.array(z.string()),
  negative: z.boolean().default(false),
});
export type Judgment = z.infer<typeof judgmentSchema>;
export function normalizePassage(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/-\s+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
export function retrievalMetrics(
  rankedIds: string[],
  relevance: ReadonlyMap<string, number>,
  k: number,
) {
  const top = [...new Set(rankedIds)].slice(0, k);
  const relevant = [...relevance].filter(([, grade]) => grade > 0);
  const retrieved = top.filter((id) => (relevance.get(id) ?? 0) > 0).length;
  const first = top.findIndex((id) => (relevance.get(id) ?? 0) > 0);
  const gain = (grade: number, rank: number) =>
    (2 ** grade - 1) / Math.log2(rank + 2);
  const dcg = top.reduce(
    (sum, id, i) => sum + gain(relevance.get(id) ?? 0, i),
    0,
  );
  const ideal = relevant
    .map(([, grade]) => grade)
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((sum, grade, i) => sum + gain(grade, i), 0);
  return {
    recallAtK: relevant.length ? retrieved / relevant.length : 0,
    mrr: first >= 0 ? 1 / (first + 1) : 0,
    ndcg: ideal ? dcg / ideal : 0,
  };
}
