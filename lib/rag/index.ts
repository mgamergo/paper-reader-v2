import { splitSentences } from "./text";
import { z } from "zod";
import {
  answerSchema,
  assistRequestSchema,
  paperSchema,
  type Chunk,
  type DebugHit,
  type Paper,
  type RagAnswer,
  type RetrievalFilter,
} from "../domain";
import { chunkPapers } from "./chunks";
import {
  contextSchema,
  draftSchema,
  embeddingIdentitySchema,
  expansionSchema,
  indexSchema,
  RagError,
  rerankSchema,
  sameIdentity,
  supportSchema,
  validateVectors,
  type AnswerInput,
  type BuildOptions,
  type Evidence,
  type RagIndex,
  type RagProvider,
} from "./contracts";
import { citationRects } from "./citations";
import { MockProvider } from "./mock";
import { bm25, cosine, rrf, sortRanked, tfidf, type Ranked } from "./ranking";
export * from "./contracts";
export { MockProvider } from "./mock";
export {
  OpenAICompatibleProvider,
  type OpenAICompatibleOptions,
} from "./provider";
export { chunkPapers } from "./chunks";
export { bm25, tfidf, cosine, rrf } from "./ranking";

async function fingerprints(papers: Paper[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const paper of papers) {
    const content = JSON.stringify({
      id: paper.id,
      title: paper.title,
      pages: paper.pages,
      outline: paper.outline,
    });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(content),
    );
    result[paper.id] = [...new Uint8Array(digest)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  }
  return result;
}
function parsePapers(input: Paper[]): Paper[] {
  const papers = z.array(paperSchema).max(100).parse(input);
  if (new Set(papers.map((p) => p.id)).size !== papers.length)
    throw new RagError("validation", "Paper ids must be unique.");
  for (const paper of papers) {
    if (
      paper.pages.length > 1000 ||
      paper.pages.reduce(
        (sum, p) =>
          sum +
          p.text.length +
          p.spans.reduce((s, span) => s + span.text.length, 0),
        0,
      ) > 10_000_000
    )
      throw new RagError("limit", "Paper exceeds index size limit.");
    if (new Set(paper.pages.map((p) => p.number)).size !== paper.pages.length)
      throw new RagError(
        "validation",
        "Page numbers must be unique per paper.",
      );
  }
  return papers;
}
export async function buildIndex(
  input: Paper[],
  options: BuildOptions = {},
): Promise<RagIndex> {
  const papers = parsePapers(input);
  const provider = options.provider ?? new MockProvider();
  const identity = embeddingIdentitySchema.parse(provider.identity);
  const contextual = options.contextual ?? true;
  const parameters = {
    childChars: options.childChars ?? 900,
    parentChars: options.parentChars ?? 3200,
  };
  const chunks = chunkPapers(
    papers,
    parameters.childChars,
    parameters.parentChars,
  );
  if (chunks.length > 20000)
    throw new RagError(
      "limit",
      "Index exceeds 20000 chunks; split the ingestion job.",
    );
  const paperContexts = new Map(
    papers.map((p) => [
      p.id,
      p.pages
        .map((page) => page.text)
        .join("\n")
        .slice(0, 24000),
    ]),
  );
  for (const chunk of chunks) {
    if (contextual) {
      const paper = papers.find((p) => p.id === chunk.paperId);
      if (!paper) throw new RagError("validation", "Chunk paper is missing.");
      const meaning = contextSchema.parse({
        meaning: await provider.contextualize({
          title: paper.title,
          paperContext: paperContexts.get(paper.id),
          section: chunk.sectionPath,
          parent: chunk.parentText,
          text: chunk.text,
        }),
      }).meaning;
      chunk.context = `Title: ${paper.title}\nSection: ${chunk.sectionPath.join(" / ") || "Body"}\nMeaning: ${meaning}`;
      chunk.contextualText = `${chunk.context}\n\n${chunk.text}`;
    }
  }
  for (let offset = 0; offset < chunks.length; offset += 24) {
    const batch = chunks.slice(offset, offset + 24);
    const vectors = validateVectors(
      await provider.embed(batch.map((c) => c.contextualText)),
      batch.length,
      identity.dimensions,
    );
    for (const [i, chunk] of batch.entries()) {
      const vector = vectors[i];
      if (!vector) throw new RagError("validation", "Missing vector.");
      chunk.embedding = vector;
    }
  }
  return indexSchema.parse({
    version: 4,
    embedding: identity,
    contextIdentity: provider.contextIdentity,
    contextual,
    fingerprints: await fingerprints(papers),
    chunks,
    parameters,
  });
}
export function serializeIndex(index: RagIndex): string {
  return JSON.stringify(indexSchema.parse(index));
}
export function deserializeIndex(serialized: string | unknown): RagIndex {
  if (typeof serialized === "string" && serialized.length > 100_000_000)
    throw new RagError("limit", "Serialized index is too large.");
  const index = indexSchema.parse(
    typeof serialized === "string" ? JSON.parse(serialized) : serialized,
  );
  validateVectors(
    index.chunks.map((c) => c.embedding),
    index.chunks.length,
    index.embedding.dimensions,
  );
  if (new Set(index.chunks.map((c) => c.id)).size !== index.chunks.length)
    throw new RagError("validation", "Duplicate chunk ids.");
  return index;
}
async function validateIndex(
  index: RagIndex,
  papers: Paper[],
  provider: RagProvider,
): Promise<void> {
  if (
    !sameIdentity(index.embedding, provider.identity) ||
    index.contextIdentity !== provider.contextIdentity
  )
    throw new RagError(
      "stale-index",
      "Provider or embedding model changed. Rebuild the index.",
    );
  const expected = await fingerprints(papers);
  for (const [id, fingerprint] of Object.entries(expected))
    if (index.fingerprints[id] !== fingerprint)
      throw new RagError(
        "stale-index",
        "Paper content changed. Rebuild the index.",
      );
  // Regeneration checks source anchors even if a persisted chunk was corrupted.
  const actual = new Map(
    chunkPapers(
      papers,
      index.parameters.childChars,
      index.parameters.parentChars,
    ).map((c) => [c.id, c]),
  );
  for (const chunk of index.chunks.filter(
    (c) => expected[c.paperId] !== undefined,
  )) {
    const canonical = actual.get(chunk.id);
    if (
      !canonical ||
      canonical.text !== chunk.text ||
      canonical.parentText !== chunk.parentText ||
      canonical.parentId !== chunk.parentId ||
      canonical.page !== chunk.page ||
      canonical.kind !== chunk.kind ||
      JSON.stringify(canonical.sectionPath) !==
        JSON.stringify(chunk.sectionPath) ||
      JSON.stringify(canonical.rects) !== JSON.stringify(chunk.rects)
    )
      throw new RagError(
        "stale-index",
        "Stored chunks or anchors do not match the ingested paper.",
      );
    if (
      chunk.contextualText !==
      (index.contextual ? `${chunk.context}\n\n${chunk.text}` : chunk.text)
    )
      throw new RagError(
        "stale-index",
        "Stored contextual text is inconsistent. Rebuild the index.",
      );
    actual.delete(chunk.id);
  }
  if (actual.size)
    throw new RagError("stale-index", "Index is incomplete. Rebuild it.");
}
function inFilter(chunk: Chunk, filters: RetrievalFilter): boolean {
  return (
    (!filters.kind || chunk.kind === filters.kind) &&
    (!filters.section ||
      chunk.sectionPath.some((s) =>
        s.toLowerCase().includes(filters.section?.toLowerCase() ?? ""),
      ))
  );
}
function evidence(chunks: Chunk[]): Evidence[] {
  return chunks.map(
    ({ id, paperId, page, text, parentText, sectionPath, kind }) => ({
      id,
      paperId,
      page,
      text,
      parentText,
      sectionPath,
      kind,
    }),
  );
}
const vectorResultSchema = z.object({
  identity: embeddingIdentitySchema,
  hits: z
    .array(z.object({ id: z.string(), score: z.number().finite() }))
    .max(20000),
});
export interface RetrievalResult {
  chunks: Chunk[];
  debug: RagAnswer["debug"];
}
export async function retrieve(input: AnswerInput): Promise<RetrievalResult> {
  const start = performance.now();
  const papers = parsePapers(input.papers),
    request = assistRequestSchema.parse(input.request);
  const provider = input.provider ?? new MockProvider();
  const index = input.index
    ? deserializeIndex(input.index)
    : await buildIndex(papers, { provider });
  await validateIndex(index, papers, provider);
  const topK = input.topK ?? 8,
    candidateK = input.candidateK ?? 24;
  if (
    !Number.isInteger(topK) ||
    topK < 1 ||
    topK > 20 ||
    !Number.isInteger(candidateK) ||
    candidateK < topK ||
    candidateK > 40
  )
    throw new RagError(
      "configuration",
      "Require 1 <= topK <= 20 and topK <= candidateK <= 40.",
    );
  const normalizeSelection = (text: string) => text.replace(/\s+/g, " ").trim();
  let sectionCandidate: Chunk | undefined;
  if (request.action === "summarize" && request.selection && request.paperId) {
    const selection = request.selection;
    const pageCandidates = index.chunks.filter(
      (chunk) =>
        chunk.paperId === request.paperId && chunk.page === selection.page,
    );
    const selected = normalizeSelection(selection.text);
    const matches = pageCandidates.filter((chunk) => {
      const text = normalizeSelection(chunk.text);
      return (
        selected.length > 0 &&
        (text.includes(selected) || selected.includes(text))
      );
    });
    const candidates = matches.length ? matches : pageCandidates;
    const anchors = (selection.rects ?? []).filter(
      (rect) => rect.width > 0 && rect.height > 0,
    );
    const anchored = candidates
      .map((chunk) => ({
        chunk,
        overlap: chunk.rects.reduce(
          (sum, rect) =>
            sum +
            anchors.reduce(
              (area, anchor) =>
                area +
                Math.max(
                  0,
                  Math.min(rect.x + rect.width, anchor.x + anchor.width) -
                    Math.max(rect.x, anchor.x),
                ) *
                  Math.max(
                    0,
                    Math.min(rect.y + rect.height, anchor.y + anchor.height) -
                      Math.max(rect.y, anchor.y),
                  ),
              0,
            ),
          0,
        ),
      }))
      .filter((candidate) => candidate.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)[0]?.chunk;
    const context = normalizeSelection(selection.context);
    sectionCandidate =
      anchored ??
      candidates.find(
        (chunk) =>
          context.length > 0 &&
          (normalizeSelection(chunk.text).includes(context) ||
            context.includes(normalizeSelection(chunk.text))),
      ) ??
      matches[0];
  }
  const selectedSection =
    request.filters.section ?? sectionCandidate?.sectionPath.at(-1);
  const filters = {
    ...request.filters,
    ...(request.action === "related" && !request.filters.kind
      ? { kind: "references" as const }
      : {}),
    ...(selectedSection ? { section: selectedSection } : {}),
  };
  const scoped = papers.filter(
    (p) =>
      (!request.paperId || p.id === request.paperId) &&
      (!request.collectionId || p.collectionIds.includes(request.collectionId)),
  );
  const allowed = new Set(scoped.map((p) => p.id));
  if (filters.expandCitations)
    for (const p of scoped)
      for (const ref of p.references)
        if (
          ref.ingestedPaperId &&
          papers.some((paper) => paper.id === ref.ingestedPaperId)
        )
          allowed.add(ref.ingestedPaperId);
  const pool = index.chunks.filter(
    (c) => allowed.has(c.paperId) && inFilter(c, filters),
  );
  const stages = [
    "scope+metadata-filters",
    ...(request.action === "related" && !request.filters.kind
      ? ["related-bibliography-scope"]
      : []),
    ...(selectedSection && !request.filters.section
      ? ["selected-section-scope"]
      : []),
    ...(filters.expandCitations ? ["ingested-citation-expansion"] : []),
    ...provider.limitations,
  ];
  if (!pool.length)
    return {
      chunks: [],
      debug: {
        queries: [request.query],
        hyde: "",
        hits: [],
        stages,
        elapsedMs: performance.now() - start,
        filters,
      },
    };
  const hints = request.selection
    ? `${request.query}\nSelected term: ${request.selection.text.slice(0, 1000)}\nSurrounding context: ${request.selection.context.slice(0, 2000)}`
    : request.query;
  const shouldExpand =
    input.rewrite !== false ||
    input.multiQuery !== false ||
    input.hyde !== false;
  const expansion = shouldExpand
    ? expansionSchema.parse(await provider.expand(hints.slice(0, 4000)))
    : undefined;
  const queries = [
    ...new Set([
      hints,
      ...(expansion && input.rewrite !== false ? [expansion.rewrite] : []),
      ...(expansion && input.multiQuery !== false ? expansion.queries : []),
    ]),
  ];
  const hyde = expansion && input.hyde !== false ? expansion.hyde : "";
  if (expansion && input.rewrite !== false) stages.push("query-rewrite");
  if (expansion && input.multiQuery !== false) stages.push("multi-query");
  if (hyde) stages.push("hyde-dense-only");
  const hits = new Map<string, DebugHit>(
    pool.map((chunk) => [chunk.id, { chunk, score: 0, stages: {}, ranks: {} }]),
  );
  const rankings: Ranked[][] = [];
  const record = (name: string, ranked: Ranked[]) => {
    const bounded = ranked.slice(0, candidateK);
    rankings.push(bounded);
    stages.push(name);
    for (const [i, item] of bounded.entries()) {
      const hit = hits.get(item.id);
      if (hit) {
        hit.stages[name] = item.score;
        hit.ranks[name] = i + 1;
      }
    }
  };
  const mode = input.mode ?? "hybrid";
  const docs = pool.map((c) => ({
    id: c.id,
    text: index.contextual ? c.contextualText : c.text,
  }));
  for (const [i, query] of queries.entries()) {
    if (mode !== "dense")
      record(`bm25:${i}`, bm25(docs, query, input.k1, input.b));
    if (mode === "hybrid") record(`tfidf:${i}`, tfidf(docs, query));
  }
  if (mode !== "bm25") {
    const denseQueries = [...queries, ...(hyde ? [hyde] : [])];
    const vectors = validateVectors(
      await provider.embed(denseQueries),
      denseQueries.length,
      index.embedding.dimensions,
    );
    for (const [i, vector] of vectors.entries()) {
      let ranked: Ranked[];
      if (input.vectorSearch) {
        const returned = vectorResultSchema.parse(
          await input.vectorSearch({
            identity: index.embedding,
            vector,
            query: denseQueries[i] ?? "",
            allowedChunkIds: pool.map((c) => c.id),
            limit: candidateK,
          }),
        );
        if (!sameIdentity(returned.identity, index.embedding))
          throw new RagError(
            "stale-index",
            "External vector search has a different embedding identity.",
          );
        if (
          returned.hits.some((h) => !hits.has(h.id)) ||
          new Set(returned.hits.map((h) => h.id)).size !== returned.hits.length
        )
          throw new RagError(
            "validation",
            "External vector search returned duplicate or out-of-scope chunks.",
          );
        ranked = sortRanked(returned.hits);
      } else
        ranked = sortRanked(
          pool
            .map((c) => ({ id: c.id, score: cosine(vector, c.embedding) }))
            .filter((h) => h.score > 0),
        );
      record(i < queries.length ? `dense:${i}` : "dense:hyde", ranked);
    }
    if (input.vectorSearch) stages.push("external-vector-search");
  }
  const fused = rrf(rankings).slice(0, candidateK);
  stages.push("rrf");
  const candidates: DebugHit[] = [];
  for (const [i, item] of fused.entries()) {
    const hit = hits.get(item.id);
    if (hit) {
      hit.score = item.score;
      hit.stages.rrf = item.score;
      hit.ranks.rrf = i + 1;
      candidates.push(hit);
    }
  }
  if (input.rerank !== false && candidates.length) {
    const scores = rerankSchema.parse({
      scores: await provider.rerank({
        query: hints,
        evidence: evidence(candidates.map((h) => h.chunk)),
      }),
    }).scores;
    if (
      scores.length !== candidates.length ||
      new Set(scores.map((s) => s.id)).size !== scores.length ||
      scores.some((s) => !candidates.some((c) => c.chunk.id === s.id))
    )
      throw new RagError(
        "validation",
        "Reranker must return exactly one score per candidate.",
      );
    for (const s of scores) {
      const hit = hits.get(s.id);
      if (hit) {
        hit.score = s.score;
        hit.stages.rerank = s.score;
      }
    }
    candidates.sort(
      (a, b) => b.score - a.score || (a.ranks.rrf ?? 0) - (b.ranks.rrf ?? 0),
    );
    candidates.forEach((h, i) => {
      h.ranks.rerank = i + 1;
    });
    stages.push("llm-rerank");
  }
  const chosen = candidates.slice(0, topK).map((h) => h.chunk);
  if (input.expandParents !== false) {
    const parentIds = new Set(chosen.map((c) => c.parentId));
    const chosenIds = new Set(chosen.map((c) => c.id));
    for (const sibling of pool)
      if (
        parentIds.has(sibling.parentId) &&
        !chosenIds.has(sibling.id) &&
        chosen.length < 32
      ) {
        chosen.push(sibling);
        chosenIds.add(sibling.id);
        const hit = hits.get(sibling.id);
        if (hit) {
          hit.stages["parent-expansion"] = 1;
          if (!candidates.includes(hit)) candidates.push(hit);
        }
      }
    stages.push("parent-child-expansion");
  }
  return {
    chunks: chosen,
    debug: {
      queries,
      hyde,
      hits: candidates,
      stages,
      elapsedMs: performance.now() - start,
      filters,
    },
  };
}
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
function refuse(
  provider: RagProvider,
  debug: RagAnswer["debug"],
  reason: string,
): RagAnswer {
  return answerSchema.parse({
    sentences: [
      {
        text: "I could not find evidence for that in the provided paper passages.",
        citations: [],
      },
    ],
    translation: "",
    terms: [],
    refused: true,
    provider: provider.name,
    debug: { ...debug, stages: [...debug.stages, reason] },
  });
}
export async function answerQuestion(input: AnswerInput): Promise<RagAnswer> {
  const start = performance.now();
  const provider = input.provider ?? new MockProvider();
  const request = assistRequestSchema.parse(input.request);
  const retrieved = await retrieve({ ...input, request, provider });
  const refusal = (reason: string): RagAnswer => ({
    ...refuse(provider, retrieved.debug, reason),
    language: request.language,
  });
  if (!retrieved.chunks.length) return refusal("refusal:no-evidence");
  const originalEvidence = evidence(retrieved.chunks);
  let draft = draftSchema.parse(
    await provider.answer({ request, evidence: originalEvidence }),
  );
  if (draft.refused || !draft.sentences.length)
    return refusal("refusal:provider");
  const expanded = [];
  for (const claim of draft.sentences) {
    const parts = splitSentences(claim.text);
    if (!parts.length || (parts.length > 1 && claim.translation))
      return refusal("refusal:unsupported-claim");
    for (const text of parts) expanded.push({ ...claim, text });
  }
  draft = draftSchema.parse({ ...draft, sentences: expanded });
  const translated = draft.sentences.filter((sentence) =>
    sentence.translation?.trim(),
  );
  const translation = translated
    .map((sentence) => sentence.translation)
    .join("\n");
  if (request.language.toLowerCase() === "english" && translated.length)
    return refusal("refusal:unsupported-claim");
  if (
    (translated.length > 0 && translated.length !== draft.sentences.length) ||
    (draft.translation &&
      normalize(draft.translation) !== normalize(translation))
  )
    return refusal("refusal:unsupported-claim");
  draft = { ...draft, translation };
  const chunkMap = new Map(retrieved.chunks.map((chunk) => [chunk.id, chunk]));
  for (const term of draft.terms)
    if (!term.evidence?.length) return refusal("refusal:uncited-term");
  const references = [
    ...draft.sentences.flatMap((sentence) => sentence.evidence),
    ...draft.terms.flatMap((term) => term.evidence ?? []),
  ];
  for (const citation of references) {
    const chunk = chunkMap.get(citation.chunkId);
    if (!chunk || !normalize(chunk.text).includes(normalize(citation.quote)))
      return refusal("refusal:invalid-citation");
  }
  const verdict = supportSchema.parse(
    await provider.verify({
      request,
      evidence: originalEvidence,
      answer: draft,
    }),
  );
  if (
    verdict.supported.length !== draft.sentences.length ||
    verdict.supported.some((value) => !value) ||
    !verdict.translationSupported ||
    !verdict.termsSupported
  )
    return refusal("refusal:unsupported-claim");
  const citationsFor = (
    references: (typeof draft)["sentences"][number]["evidence"],
  ) =>
    references.flatMap((reference) => {
      const chunk = chunkMap.get(reference.chunkId);
      return chunk
        ? [
            {
              chunkId: chunk.id,
              paperId: chunk.paperId,
              page: chunk.page,
              quote: reference.quote,
              rects: citationRects(chunk, reference.quote, input.papers),
            },
          ]
        : [];
    });
  return answerSchema.parse({
    sentences: draft.sentences.map((sentence) => ({
      text: sentence.text,
      citations: citationsFor(sentence.evidence),
      ...(sentence.translation ? { translation: sentence.translation } : {}),
    })),
    translation,
    language: request.language,
    terms: draft.terms.map((term) => ({
      term: term.term,
      definition: term.definition,
      ...(term.translation ? { translation: term.translation } : {}),
      citations: citationsFor(term.evidence ?? []),
    })),
    refused: false,
    provider: provider.name,
    debug: {
      ...retrieved.debug,
      elapsedMs: performance.now() - start,
      stages: [
        ...retrieved.debug.stages,
        "exact-quote-validation",
        "sentence-support-check",
        ...(translated.length ? ["paired-translation-citations"] : []),
        ...(draft.terms.length ? ["definition-passage-citations"] : []),
      ],
    },
  });
}
