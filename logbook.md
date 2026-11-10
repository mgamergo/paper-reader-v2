# Logbook

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
