# RAG integration contract

All implementation and verification runs are inside the existing boxes.dev instance at `/home/boxes/repos/paper-reader-v2`. No dependencies, shared domain, UI, backend files, or git commits were changed by this worker.

## Public API

```ts
buildIndex(papers: Paper[], options?: BuildOptions): Promise<RagIndex>
answerQuestion(input: AnswerInput): Promise<RagAnswer>
retrieve(input: AnswerInput): Promise<RetrievalResult>
serializeIndex(index: RagIndex): string
deserializeIndex(value: unknown): RagIndex
```

`BuildOptions` accepts `provider`, `contextual`, `childChars`, and `parentChars`. `AnswerInput` requires `papers` and `request`, and optionally accepts `index`, `provider`, `mode` (`bm25`, `dense`, `hybrid`), `rewrite`, `multiQuery`, `hyde`, `rerank`, `expandParents`, `k1`, `b`, `topK`, `candidateK`, and `vectorSearch`. Defaults enable every stage, use 900-character children/3200-character parents, k1=1.2, b=0.75, topK=8, and candidateK=24.

`RagProvider`, `RagIndex`, `VectorSearch`, `EmbeddingIdentity`, `indexSchema`, `embeddingIdentitySchema`, `sameIdentity`, and `RagError` are exported from `lib/rag/index.ts`. Error codes distinguish configuration, provider, validation, limits, and stale indexes. Treat the module and provider credentials as server code.

## Persistence and authorization

The index format is **version 3**, including baseline-aware line grouping, zero-based outline ancestry, and cross-page section continuation. Earlier worker snapshots used versions 1 and 2; rebuild those indexes. The parent adapter parses `indexSchema`, so a version-1/2 manifest fails parsing and is rebuilt through its existing catch path. No shared domain migration is needed.

Persist the full manifest (version, embedding identity, context identity, contextual flag, paper fingerprints, parameters) with its chunks. Chunk rows retain the exact domain `Chunk` shape. Keep original child text, parent text, context prefix, contextual text, anchors, and embeddings; the context prefix is not citation evidence. Preserve parameters when combining indexes. Combine only indexes with equal format, embedding identity, context identity, contextual flag, and chunk parameters. The public retrieval boundary checks fingerprints and regenerates source chunks to catch stale/corrupted text or anchors.

Paper fingerprints are SHA-256 of JSON `{ id, title, pages, outline, references }` in that property order. Embedding identity includes provider host, model, dimensions, and revision. Context identity includes the chat model and prompt version. Change the revision when an endpoint silently changes an embedding model. Never reuse vectors across model/dimension/revision changes.

The caller must load only papers the current user owns or can read. This library cannot infer authentication from `Paper`. `paperId` and `collectionId` scope those supplied papers. Citation expansion follows one hop of explicit `Reference.ingestedPaperId` links into that same supplied set; it never fetches URLs or guesses relationships from titles.

## Real vector search

`VectorSearch` receives `{ identity, vector, query, allowedChunkIds, limit }` and returns `{ identity, hits: [{ id, score }] }`. The callback must enforce ownership and search the matching embedding model/version. Return chunk IDs (not database row IDs), finite scores, and the actual identity. Duplicate, out-of-scope, or mismatched-identity results fail. Apply section/kind eligibility before final top-k; querying a broad vector top-k and filtering afterward can underfill results. Parent owns the Convex vector index and filter strategy. No in-memory operation is labeled Convex: debug adds `external-vector-search` only when the callback was called.

The default offline provider has **256 dimensions**. Parent's Convex configuration also uses 256. Configure real embedding requests with `dimensions: 256` only for models that support that dimension; otherwise migrate the vector schema and all affected stored vectors together. Set `sendDimensions: false` for a compatible endpoint whose model has a fixed dimension and does not accept the parameter.

## Providers and caching

`new OpenAICompatibleProvider({ apiKey, chatModel, embeddingModel, baseUrl?, dimensions?, revision?, timeoutMs?, maxCalls?, cache?, sendDimensions?, trustedHosts? })` supports OpenAI and OpenRouter by default. Additional compatible HTTPS hosts require an explicit `trustedHosts` deployment allowlist. Do not map request/user/document fields into that allowlist or API endpoint. HTTPS, port 443, no URL credentials/query/fragment, redirect rejection, timeouts, bounded response streams, bounded inputs, and a provider-instance call budget remain enforced. Create one provider per bounded request/ingestion job; the call counter is intentionally not global.

Supported cache modes are `automatic`, `openrouter-anthropic`, and `none`. Explicit ephemeral controls are restricted to OpenRouter `anthropic/` models. Stable instructions and an untrusted paper prefix (title plus up to 24,000 characters of original paper text, explicitly marked as potentially truncated) precede changing section/parent/child data. The same paper prefix is reusable across all child contextualization requests. Short documents can remain below a model’s cache threshold; explicit markers do not guarantee cache eligibility or a hit. Automatic providers can cache matching prefixes. `none` emits no explicit markers; it cannot override an endpoint's own automatic caching. Minimum prefix lengths and cache hits depend on the provider/model; no savings are claimed. See [OpenRouter caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching) and [contextual retrieval](https://www.anthropic.com/research/contextual-retrieval).

No tools are offered to the answer model. Document content, user selection, titles, parent context, and queries are serialized into an untrusted user-data message. Only original retrieved child passages support citations. Quotes are validated against original text; every generated claim then passes a separate support check. Invalid or unsupported results refuse rather than returning a partial answer with an unverified translation.

## Answer and UI behavior

`RagAnswer`, `Chunk`, and `DebugHit` match `lib/domain.ts` exactly. Debug hits include original chunks, per-stage numeric scores/ranks, RRF and rerank results, and parent-expansion markers. Debug queries include the selected text/context used as retrieval hints; HyDE is separate and only enters dense search. The stage list includes provider limitations. Render those limitations visibly for offline answers.

The mock is lexical and extractive. It rejects bare headings, naming-only sentences, and fragments, favors explanatory source sentences, and returns no invented translations, definitions, or simplifications. Hindi, Telugu, Marathi, and other languages require the real provider; the prompt requests a faithful translation, and a support check validates it. Contextual word explanation uses selection plus surrounding text for retrieval and disambiguation, while all factual claims still require paper evidence. Difficulty rewrite, summaries, and figure/equation explanations run through the same grounded real-provider path.

Sentence citations contain page numbers and quotation-overlapping source-line rectangles where available. Text-only ingestion can provide a page anchor but no rectangle. Baseline grouping handles small mathematical subscripts better, but complex tables, OCR, multi-column spanning figures, and displayed equations remain heuristic. Figure/equation support uses extracted captions/text, not vision or formula reconstruction. Never describe the mock as understanding figures or translating languages.

## Schema limitations and remaining work

The existing schema has one translation string and uncited glossary terms; it cannot attach sentence-specific anchors to translated sentences or individual definitions. Those fields are validated against cited English evidence but the UI cannot represent their own anchor mapping. A future domain extension could represent translated sentences with citation IDs and add explicit `limitations`, `finishReason`, and provenance/model-usage fields. No domain change is required to integrate this implementation now.

A second model pass is not proof of entailment or prompt-injection immunity. No paid model or live compatible endpoint was exercised. Protocol tests validate payloads, output rejection, caching markers, custom-host configuration, timeouts, and bounded responses. Real-model multilingual quality, semantic retrieval quality, cost, and latency remain unmeasured. Parent owns authenticated Convex integration and browser verification; the implementation worker did not start application services or a browser.

See `docs/rag-evaluation.md` for the README-ready ablation table and `artifacts/rag-evaluation.json` for exact per-question failures. Expected-answer judgments remain distinct from quote faithfulness; topical headings do not qualify merely because they are quoted correctly.

The real-layout regression uses the parent’s cached public Attention Is All You Need PDF (1706.03762v7), including all 15 pages. Prepare it with `bun scripts/cache-import-fixtures.ts .data/import-fixtures 1706.03762` before running that integration test. No text/PDF from that non-CC-BY paper is copied into the tracked RAG corpus. It verifies three-level native outline ancestry, bibliography continuation on pages 11–12, and post-bibliography visualization pages 13–15.
