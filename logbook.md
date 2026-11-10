# Logbook

## 2026-11-10 • Paired native citations

Paired translations and glossary definitions now carry passage links, preserve the answer's language, and reject uncited definitions or unmapped native text. Seven focused protocol regressions pass. English sentence splitting now happens before support verification and preserves spaced decimals. Production browser verification of these newest fields is pending the acceptance worker's handoff and a rebuild. All secret-history scanning completed with zero findings at dee1be7; repeat on the final commit.

## 2026-11-10 • Advanced RAG release gate

- RAG worker delivered contextual indexing, layout-aware parent/child chunks, BM25/TF-IDF/dense/RRF stages, query expansion/HyDE, reranking, filters/graph expansion, exact source checks and real-paper evaluation. Index format3; offline embedding revision3, 256dimensions.
- Fixed three unchanged judgment failures: decimal and author-abbreviation sentence boundaries, line-hyphen lexical matching, and overbroad naming-clause rejection. Added focused regressions and a full unchanged-judgment integration test. Eval now exits nonzero for any full-pipeline passage/answer/refusal/support failure.
- Latest complete test run: 91pass, 0fail, 404assertions across18files. Project strict typecheck and global ESLint passed. Vendored generated PDF worker is excluded from source lint; PostCSS export and shared formatting corrected.
- Latest full RAG configuration: recall@5=1, MRR@5=0.958333, nDCG@5=0.969244, extractive quote faithfulness=1, expected-answer match=1, negative refusal=1. Twelve fixed positives/four negatives, two real CC BY papers, 98chunks. These are small-corpus hash/extractive mock regressions, not real semantic/multilingual quality. Baseline ablations and exact source/file hashes retained.
- Browser acceptance delegate owns the only browser/test worker. Production app remains the previously built artifact; the current RAG changes still require final production rebuild and full browser rerun after acceptance fixes.

## 2026-11-10 • Ownership, vector scopes, and production reader integration

- Backend feature 46b1e4e is pushed. RAG adapter now persists contextual index manifests and queries actual Convex vector search; contextual/BM25/TF-IDF/dense/RRF/rerank stages appear in API debug. Integration tests verify quote/page rectangles and unsupported refusal. Core RAG source/eval delegate is still finishing its owned paths.
- Real arXiv import Attention Is All You Need succeeded: 15 pages, 42 parsed references, indexed ready. Root test paper ID a2fb805e-5f43-4cb9-a2b4-52f4cde03866.
- Added real Convex tests with two local admin-impersonated identities. Fourteen assertions verify cross-user denial for paper/PDF/annotation/glossary/chat/chunk access and mutation. This proves function ownership rules, not external Clerk JWT/sign-in integration. Local admin credentials remain only in ignored Convex configuration and are never printed.
- Vector filters now prefilter by owned composite chunk scopes for section/kind selection; regression asserts an explicit allowed chunk is the only dense hit. Index version changed to invalidate previous vector scopes.
- Production build passed. Production Chromium library and selectable PDF text-layer smoke checks passed without console/page/network/HTTP errors. Desktop1440x900, tablet768x1024 and mobile390x844 root overflow checks passed.
- Screenshot inspection found clipped import buttons, a too-narrow tablet paper pane, and a resize-related page indicator bug. Fixed button sizing, tablet Read/Learn breakpoint and retained IntersectionObserver entries. Production viewport regression now also asserts page1 remains page1 after resizing; passed.
- Frontend shortcut/export tests: 11 passed, 77 assertions. Latest targeted UI/backend run: 16 passed, 131 assertions. Production broader flows, complete retrieval eval and both sol-loop passes remain pending.
- Active parent-owned services: Convex started by /tmp/paper-reader-v2-convex.pid; production Next by /tmp/paper-reader-v2-next.pid, loopback3000. Logs under /tmp/paper-reader-v2-*. Final cleanup must stop these process trees only.

## 2026-11-10 • Persistence and ingestion

- Convex local deployment is running. Convex 1.49 rejects deprecated --local; supported anonymous local mode used and documented. Explicit ALLOW_LOCAL_AUTH=true is local-only; Clerk production config fails closed.
- Added owner-scoped metadata/pages/storage uploads, reading state, collections, annotations, glossary, history and vector index. PDF upload claims prevent cross-workspace attachment; orphan uploads expire.
- Public imports validate URL and every redirect, pin DNS resolution to public addresses, and bound response size/time. Real arXiv metadata check returned Attention Is All You Need with 8 authors.
- Backend strict types and scoped ESLint passed. 34 tests / 66 assertions passed including real PDF extraction and actual Convex/storage persistence. Browser headless shell installed and launch smoke passed. Full app/browser/retrieval checks pending.
- TypeScript pinned to 6.0.3 because typescript-eslint rejects 7.0.2; no lint exclusions added.
- Frontend and RAG delegates own disjoint paths; their uncommitted work is intentionally excluded from this feature commit.

## 2026-11-10 • Session established

- New private repository mgamergo/paper-reader-v2, branch dev. No prior paper-reader code or threads accessed.
- boxes.dev project 55820d6f-3b36-4755-a698-99a26f8ca460; fresh instance 0e09ad54-c2a4-4c19-8e9b-2d80fca789a4; operation qd7ssx0mk0w4hdjnc4ttht0dc58hzn8x succeeded. Template preserved.
- Infisical login verified. Visible projects Joyne and api-connector-gateway do not match this app; no unrelated secrets read. Deterministic offline provider until a project is configured.
- Instruction source cloned with gh from mgamergo/skills on workstation because box gh integration cannot access that repo; placeholders filled in tracked AGENTS.md. Session instructions override rebase-on-main and local-only commits. New dev-only repo has no main.
- All development, installs, services, and tests run inside session box through dvb exec.
- Gates: strict types, formatting, lint, core/integration tests, real-paper retrieval metrics and ablations, Chromium flows at three sizes, two sol-loop reviews.
