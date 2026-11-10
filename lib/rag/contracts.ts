import { z } from "zod";
import {
  chunkSchema,
  type AssistRequest,
  type Chunk,
  type Paper,
} from "../domain";

export const embeddingIdentitySchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  dimensions: z.number().int().min(8).max(8192),
  revision: z.string().min(1),
});
export type EmbeddingIdentity = z.infer<typeof embeddingIdentitySchema>;
export const contextSchema = z.object({ meaning: z.string().min(1).max(1500) });
export const expansionSchema = z.object({
  rewrite: z.string().min(1).max(4000),
  queries: z.array(z.string().min(1).max(4000)).max(3),
  hyde: z.string().min(1).max(4000),
});
export type QueryExpansion = z.infer<typeof expansionSchema>;
export const rerankSchema = z.object({
  scores: z
    .array(z.object({ id: z.string(), score: z.number().min(0).max(1) }))
    .max(40),
});
export const claimSchema = z.object({
  text: z.string().min(1).max(2500),
  translation: z.string().max(4000).optional(),
  evidence: z
    .array(
      z.object({ chunkId: z.string(), quote: z.string().min(8).max(6000) }),
    )
    .min(1)
    .max(4),
});
export const draftSchema = z.object({
  sentences: z.array(claimSchema).max(12),
  translation: z.string().max(12000).default(""),
  terms: z
    .array(
      z.object({
        term: z.string().min(1).max(150),
        definition: z.string().min(1).max(1000),
        translation: z.string().max(2000).optional(),
        evidence: claimSchema.shape.evidence.optional(),
      }),
    )
    .max(12),
  refused: z.boolean(),
});
export type DraftAnswer = z.infer<typeof draftSchema>;
export const supportSchema = z.object({
  supported: z.array(z.boolean()).max(12),
  translationSupported: z.boolean(),
  termsSupported: z.boolean(),
});
export type SupportVerdict = z.infer<typeof supportSchema>;
export type Evidence = Pick<
  Chunk,
  "id" | "paperId" | "page" | "text" | "parentText" | "sectionPath" | "kind"
>;
export interface RagProvider {
  readonly name: string;
  readonly identity: EmbeddingIdentity;
  readonly contextIdentity: string;
  readonly limitations: readonly string[];
  contextualize(input: {
    title: string;
    paperContext?: string;
    section: string[];
    parent: string;
    text: string;
  }): Promise<string>;
  expand(query: string): Promise<QueryExpansion>;
  embed(texts: string[]): Promise<number[][]>;
  rerank(input: {
    query: string;
    evidence: Evidence[];
  }): Promise<z.infer<typeof rerankSchema>["scores"]>;
  answer(input: {
    request: AssistRequest;
    evidence: Evidence[];
  }): Promise<DraftAnswer>;
  verify(input: {
    request: AssistRequest;
    evidence: Evidence[];
    answer: DraftAnswer;
  }): Promise<SupportVerdict>;
}
export const indexSchema = z.object({
  version: z.literal(3),
  embedding: embeddingIdentitySchema,
  contextIdentity: z.string(),
  contextual: z.boolean(),
  fingerprints: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
  chunks: z.array(chunkSchema).max(20000),
  parameters: z.object({
    childChars: z.number().int().min(200).max(3000),
    parentChars: z.number().int().min(500).max(12000),
  }),
});
export type RagIndex = z.infer<typeof indexSchema>;
export type RetrievalMode = "bm25" | "dense" | "hybrid";
export interface RankedVectorRequest {
  identity: EmbeddingIdentity;
  vector: number[];
  query: string;
  allowedChunkIds: string[];
  limit: number;
}
export interface RankedVectorResult {
  identity: EmbeddingIdentity;
  hits: { id: string; score: number }[];
}
export type VectorSearch = (
  input: RankedVectorRequest,
) => Promise<RankedVectorResult>;
export interface BuildOptions {
  provider?: RagProvider;
  contextual?: boolean;
  childChars?: number;
  parentChars?: number;
}
export interface RetrievalOptions {
  mode?: RetrievalMode;
  rewrite?: boolean;
  multiQuery?: boolean;
  hyde?: boolean;
  rerank?: boolean;
  expandParents?: boolean;
  k1?: number;
  b?: number;
  topK?: number;
  candidateK?: number;
  vectorSearch?: VectorSearch;
}
export interface AnswerInput extends RetrievalOptions {
  papers: Paper[];
  request: AssistRequest;
  provider?: RagProvider;
  index?: RagIndex;
}
export class RagError extends Error {
  constructor(
    public readonly code:
      "configuration" | "provider" | "validation" | "limit" | "stale-index",
    message: string,
  ) {
    super(message);
    this.name = "RagError";
  }
}
export function sameIdentity(
  a: EmbeddingIdentity,
  b: EmbeddingIdentity,
): boolean {
  return (
    a.provider === b.provider &&
    a.model === b.model &&
    a.dimensions === b.dimensions &&
    a.revision === b.revision
  );
}
export function validateVectors(
  vectors: number[][],
  count: number,
  dimensions: number,
): number[][] {
  if (
    vectors.length !== count ||
    vectors.some(
      (v) =>
        v.length !== dimensions ||
        v.some((n) => !Number.isFinite(n)) ||
        !v.some((n) => n !== 0),
    )
  ) {
    throw new RagError(
      "validation",
      "Embedding count, dimensions, or finite nonzero values are invalid.",
    );
  }
  return vectors;
}
