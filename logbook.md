# Logbook

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
