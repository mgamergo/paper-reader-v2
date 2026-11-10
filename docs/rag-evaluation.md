# RAG evaluation

Generated 2026-11-10T14:39:00.054Z. Base revision `eaf34e6bb1d55c8965fdda108a1b0e3aff8556e7`; working tree file SHA-256 hashes in `artifacts/rag-evaluation.json` identify the actual tested implementation. The revision and file hashes identify the tested implementation.

| Ablation                     | Recall@5 | MRR@5 | nDCG@5 | Extractive faithfulness | Expected-answer match | Negative refusal |
| ---------------------------- | -------: | ----: | -----: | ----------------------: | --------------------: | ---------------: |
| BM25-only                    |    91.7% | 0.808 |  0.835 |                  100.0% |                 91.7% |           100.0% |
| Dense-only (hash mock)       |    75.0% | 0.611 |  0.647 |                  100.0% |                 75.0% |           100.0% |
| Hybrid                       |    91.7% | 0.736 |  0.783 |                  100.0% |                 91.7% |           100.0% |
| Hybrid + contextual          |   100.0% | 0.861 |  0.897 |                  100.0% |                100.0% |           100.0% |
| Hybrid + contextual + rerank |   100.0% | 0.958 |  0.969 |                  100.0% |                100.0% |           100.0% |

## Corpus and protocol

Two real arXiv papers, OLMo (2402.00838v4) and The Pile (2101.00027v1), first six PDF pages each; 98 chunks. Fixtures retain extracted text and approximate PDF glyph boxes, CC BY 4.0 attribution, original PDF SHA-256, source URL, download time, and page numbers. PDFs are not retained. Run `bun scripts/fetch-eval-papers.ts` to refresh from the pinned versions; failed downloads never become synthetic data. See fixture provenance for full author lists.

Eight development questions tune BM25 k1/b over a 3×3 grid. Twelve disjoint positive test questions and four negative questions are evaluated only after selecting k1=1.2, b=0.75. All nine development grid configurations tied on this small set; the documented tie-break retained the defaults, not an evidence-backed tuning improvement. Development/test question text and passage judgments are fixed in `tests/fixtures/rag/judgments.json`. Ranking uses exact expected passage matches, not the answer model's relevance scores. Recall divides by all judged-relevant chunks, MRR@5 uses the first hit, nDCG@5 uses grade-3 passage judgments. No partial credit for merely finding the correct paper or page.

All five variants use identical original queries: rewrite, multi-query, HyDE, and parent expansion are disabled to isolate the listed changes. Those stages are tested separately through the public pipeline. Hybrid fuses BM25, independent TF-IDF cosine, and hash-dense ranks. Faithfulness checks each emitted English claim against its exact cited source quote; it excludes refusals. Expected-answer match additionally checks manually specified answer patterns. Negative queries require refusal, including a false optimizer premise. Per-question failures and outputs remain in the JSON artifact.

## Limits

These are reproducibility checks, **not production model quality**. The offline provider uses hashed lexical tokens, template/excerpt context, lexical sentence reranking, and extractive English answers. It has no learned dense semantics, translation, or genuine simplification. Exact extraction naturally produces high faithfulness but can select irrelevant or incomplete sentences and fail false-premise questions. The test set is small and shares two source papers with development. BM25 parameters were selected using development questions only; generic heading-selection fixes came from a separate paper. The fixed test set was then inspected to repair sentence-boundary, naming-clause, and line-hyphenation failures; results were rerun without changing judgments. This is a development regression benchmark, not a pristine one-shot blind evaluation. No provider keys were used. Real-model multilingual quality, semantic entailment, retrieval latency/cost, and full-paper/image comprehension remain unmeasured.

Reproduce with `bun run eval:rag`. Full results, selected parameters, grid scores, failures, provider identity, and tested file hashes: `artifacts/rag-evaluation.json`.
