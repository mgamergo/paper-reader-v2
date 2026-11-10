# Logbook

## 2026-11-10 • Final committed-SHA verification and preservation

Clean starting SHAf4a46c3f9a720a95231a0922e195e4cfb0b89479; application fingerprinte05253e6084e7e64198890d6b0a74c0558f0d1ccbc3033b00e0f7c779b35adff; build1wkjn5MY4txgwCr9ubRbI; box0e09ad54-c2a4-4c19-8e9b-2d80fca789a4. Final format/lint/strict types,120tests/563assertions, unchanged RAG evaluations and production build pass. Matching final37browser cases pass with0failed/skipped/flaky; visual cancellation/drawer probe and4comparison viewports/themes pass with zero unexpected diagnostics. All12reader screenshots were captured, hashed and inspected; actual paper and authored/manual Hindi fixtures stay explicit. Both Sol passes approved(3functionality/2UIrounds). No application code changed after this tested SHA.

Private export including PDF storage refreshed at.data/backups/2026-11-10T17-11-32.382Z-64ba0290, independently SHA/ZIP-verified inside box and on workstation. One paper/15pages/1PDF/1manifest/79chunks remain, no user-visible test residue. Final audit discovered134historical cache manifests from early runs; removed only those stale caches while retaining the current logical manifest unchanged and preserving pre-cleanup snapshot. This was cache maintenance, no code change. Full restore untested. Own Next/Convex/test browsers stopped and ports3000/3001/3210/3211 verified closed; box left running/intact. Final report/evidence-only commit follows; real-provider/Clerk quality and eight P2deferrals remain explicit.

## 2026-11-10 • Both independent reviews approved

Functionality/RAG/security approved after3rounds; UI/UX approved after2rounds with allU1–U4 resolved and no new findings. Independent UI round2 passed global formatting/lint/types,2focused unit tests/8assertions and5focused browser cases, and confirmed unchanged source/build identity. Parent full gates are120tests/563assertions and37browser cases, unchanged RAG judgments/ablations and production build. Four UI feature commits were pushed and remote-equality checked individually: d464ae3,90fff05,c92ca83,d002d5d. All73P0+12P1 checklist rows now pass within explicit local/mock scope;8P2deferred. Final clean-SHA verification, fresh private backup and final report follow.

## 2026-11-10 • UI/UX review fixes

Independent UI review passed the old119source tests and35browser tests but found four real defects: typed annotation tag separators vanished; search/source links scrolled only to page tops; annotation/glossary deletion lacked confirmation; mobile navigation did not own focus. Fixed all four with raw tag drafts, rendered-rectangle scrolling, a shared cancelable permanent-delete dialog, and a Radix modal drawer. Added high-zoom search/note/chat visibility, typed tag persistence, physical cancellation persistence and drawer focus/import-handoff regressions. Initial focused3/5run exposed two additional defects; fixed the focus handoff and an exact-source mock comparison-verb refusal without changing the question or weakening assertions. Source120tests/563assertions and all unchanged RAG judgments pass; focused5/5browser run passes. Full37case run and Sol round2 are next. Source changes remain uncommitted/unpushed during the review loop.

## 2026-11-10 • Functionality approval and UI stack

Functionality/security/RAG sol-loop approved after three rounds. Both reviewer findings and five parent audit items are resolved; no findings declined. Full119tests/559assertions, unchanged real-paper evaluation, production build, and35browser cases passed before the UI stack change. Each of five source feature commits was pushed and remote equality verified, ending at700259f. Added the requested shadcn/ui owned Button/CVA/Slot/cn pattern and components.json, preserving reader CSS and upstream MIT notice. Its complete source gate and35/35browser cases passed on build ozyHqafgvciYio2xE1RZZ, source fingerprint ff84880b4f0c567857d7fbd5a8f8d52e3de1c36dced03cdaf53365dd103f3ead. Separate UI/UX review follows.

## 2026-11-10 • Functionality review fixes

Sol round1 found incoming-Host authorization and glossary-review reset bugs. Fixed both; source tests cover actual local Convex resave persistence and the running Next authority guard. Parent audit also fixed related-work bibliography scope, selected-section summaries, hosted account entry/controls, and collection conversation continuity through cross-paper source jumps. Contextual Explain remains scoped to the reader even when collection chat is selected. Source115tests/541assertions and full32/34-case browser runs passed before the last cross-paper change; focused distinct-source case passes. Complete35-case run and Sol round2 pending. No pushes during review loop; current changes intentionally uncommitted until agreement.

## 2026-11-10 • Extended acceptance

Twelve additional browser cases passed on the fresh production build: DOI/URL imports, drag-drop, invalid/oversized/scanned imports and retry, citation groups/ranges/author-year/superscripts/unresolved, transformed highlight alignment, all assistant action protocols, filters, keyboard controls, Hindi paired-citation UI protocol and mobile import bounds. Hindi is an explicitly manual protocol fixture, not generated model quality. Expected resource console errors are allowed only for exact predeclared HTTP400 import validation cases. Other diagnostics stay strict. Headings now live in section metadata rather than answer text; index format4 forces rebuild. Private local export including files passed ZIP integrity; restore untested. Full 31-case release run and both independent reviews are next.

## 2026-11-10 • Acceptance fixes and production retrieval

Fixed coordinate-aware repeated-word context, numbered-equation previews, exact-source glossary extraction, stale citation links and collection chat cleanup, and normalized local loopback origins. All 106 unit/integration tests passed with 488 assertions; strict types, lint and production build passed. Both isolated ablation and complete production-stage retrieval pass unchanged real-paper judgments. Fresh production browser run is active; no browser acceptance claim until it completes. Added arXiv DataCite DOI routing and bounded follow-up query context. Escape can be remapped while retaining physical Escape for accessible dismissal.

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
