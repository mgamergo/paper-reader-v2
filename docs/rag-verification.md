# Retrieval verification

The current release source gate passes all unit/integration tests, the fixed real-paper evaluation and a production build. Its tested SHA, source fingerprint, box ID, exact commands and outcomes are recorded in `artifacts/release-source-verification.json` and `docs/release-verification.md` when finalized. Earlier worker-only evidence is retained in `artifacts/rag-worker-verification.json`; it is historical, not the final project result.

`bun run eval:rag` uses two actual CC BY papers, 93 body chunks, eight development questions and twelve positive/four negative fixed test questions. Five controlled ablations isolate BM25, hash-dense, hybrid, contextual prefix and rerank effects. A sixth run enables rewriting, multi-query, HyDE and parent expansion together and must pass every unchanged passage/answer/refusal judgment. Reports retain every case and file hashes; failed release gates exit nonzero.

Regression coverage includes column order, nested headings, bibliography continuation, appendix reset, sentence boundaries/decimals/abbreviations, exact source support, paired native claims/definitions, incompatible indexes, ownership-filtered Convex vectors, and repeated identical quotations anchored to the actual retrieved PDF occurrence. Headings stay in section metadata rather than being emitted as body answer text.

Index format4, body-layout revision2 and offline embedding revision4 invalidate earlier persisted indexes. Real compatible-provider payloads, caching prefixes, response validation and deployment host configuration are tested with deterministic protocol doubles. No paid/live model request, external Clerk sign-in, real semantic retrieval quality, generated multilingual quality, cache savings, latency or cost was measured. The manual Hindi browser fixture proves UI bindings only.

The metrics are a development regression benchmark, not a blinded semantic-quality benchmark. See `rag-evaluation.md` for provenance, judgments, tuning tie-breaks and limits. Final browser and independent-review results belong to the overall release report.
