# Release verification and handoff

The complete reader and advanced RAG implementation are built and verified within the authorized local/mock scope. All 73 P0 and 12 P1 items pass;8 P2 items are deferred. The complete 93-row item-by-item status and shortcut contract is [FEATURES.md](../FEATURES.md). Real Clerk sessions and generated multilingual/learned-model quality still require the keys below and live acceptance; no such quality is claimed from mocks.

## Tested identity

- Repository: https://github.com/mgamergo/paper-reader-v2, PRIVATE, branch `dev`. No `main` merge, deployment or social post.
- Tested application SHA: `f4a46c3f9a720a95231a0922e195e4cfb0b89479`. It was committed and clean when final source verification began.
- Source SHA-256: `e05253e6084e7e64198890d6b0a74c0558f0d1ccbc3033b00e0f7c779b35adff`.
- Production build: `1wkjn5MY4txgwCr9ubRbI`.
- boxes.dev instance: `0e09ad54-c2a4-4c19-8e9b-2d80fca789a4`, project 55820d6f-3b36-4755-a698-99a26f8ca460. Fresh creation operation qd7ssx0mk0w4hdjnc4ttht0dc58hzn8x; original Template preserved.
- Later commit contains only documentation, reports, screenshots and the separately verified static comparison artifact. Application code is unchanged after the tested SHA; the fingerprint was independently recomputed.

## Final checks

| Check                                     | Outcome                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `bun run format:check`                    | PASS                                                                                                                              |
| `bun run lint`                            | PASS, zero warnings                                                                                                               |
| `bun run typecheck`                       | PASS, strict TypeScript                                                                                                           |
| `bun run test`                            | 120 passed, 0 failed, 563 assertions across 26 files; actual local Convex/storage integration                                     |
| `bun run eval:rag`                        | PASS all fixed full-pipeline passage/answer/refusal/support judgments and all ablations                                           |
| `bun run build`                           | PASS                                                                                                                              |
| Browser release gate                      | 37 passed; 0 failed, skipped, or flaky; one Chromium worker, matching build/source                                                |
| Additional changed-flow browser selection | 5/5 passed; independent Sol rerun also5/5                                                                                         |
| Static comparison view                    | 4 desktop/mobile × light/dark scenarios passed; data values checked against eval JSON                                             |
| Secret history scan                       | 0 findings at tested SHA; final post-report scan is retained separately on the workstation                                        |
| Private backup                            | Includes database and actual PDF storage; SHA-256 and ZIP integrity verified inside box and on workstation; full restore untested |

Final commands: `BOX_INSTANCE_ID=0e09ad54-c2a4-4c19-8e9b-2d80fca789a4 bun scripts/verify-release.ts --phase source --base-url http://127.0.0.1:3000`, then the matching production server and `--phase browser`. Exact command outcomes, durations, build identity and logs are in [source proof](../artifacts/release-source-verification.json) and [browser proof](../artifacts/release-browser-verification.json). Aggregate assertions and data preservation are in [verification facts](../artifacts/rag-verification.json).

Browser diagnostics attach before navigation for console errors, uncaught page errors, failed requests and HTTP 4xx/5xx. Only exact declared invalid-import HTTP 400/resource-console pairs are expected. All other diagnostics fail. Initial worker 15/19 and focused 3/5 runs are historical failures; fixes and their passing reruns are retained in the logbook/review ledger. No tests were skipped or weakened.

## Retrieval results

| Ablation                     | Recall@5 | MRR@5 | nDCG@5 | Extractive faithfulness | Expected-answer match | Negative refusal |
| ---------------------------- | -------: | ----: | -----: | ----------------------: | --------------------: | ---------------: |
| BM25-only                    |    91.7% | 0.808 |  0.835 |                  100.0% |                 91.7% |           100.0% |
| Dense-only (hash mock)       |    66.7% | 0.542 |  0.574 |                  100.0% |                 66.7% |           100.0% |
| Hybrid                       |    83.3% | 0.642 |  0.690 |                  100.0% |                 83.3% |           100.0% |
| Hybrid + contextual          |   100.0% | 0.806 |  0.855 |                  100.0% |                100.0% |           100.0% |
| Hybrid + contextual + rerank |   100.0% | 0.958 |  0.969 |                  100.0% |                100.0% |           100.0% |

Two real CC BY 4.0 papers, OLMo and The Pile; first 6 pages each, 93 chunks. Eight development questions select BM25 k1=1.2/b=0.75 (the grid tied); 12 fixed positive questions and 4 negatives form the regression set. The full production-stage run with rewrite/multi-query/HyDE/parent expansion also has recall@5=1, MRR@5=0.958333, nDCG@5=0.969244, exact-quote faithfulness=1, expected-answer match=1, and negative refusal=1.

BM25, TF-IDF cosine and RRF are separate algorithms. All five ablations disable expansion/parent retrieval equally; the sixth JSON row exercises all production stages. [Per-question results and file hashes](../artifacts/rag-evaluation.json), [protocol/limits](rag-evaluation.md), and [self-contained comparison](../artifacts/retrieval-comparison.html) preserve the full evidence. These are small reused-corpus token-hash/extractive regressions, not blind semantic-model or multilingual evaluations.

## Independent reviews

Both sol-loop passes approved with `gpt-6.1-sol`, high effort, priority service; usage was not exposed. Functionality/RAG/security took 3 rounds; UI/UX took 2. No open blocker/should/nit findings and no declined findings remain.

Functionality fixes cover incoming-Host authorization, preserving glossary schedules on resave, short reference titles, selected-section/rectangle context, hosted account entry/fail-closed configuration, collection conversation continuity, and stable index fingerprints. UI fixes cover character-by-character tag entry, visible high-zoom search/note/chat passage jumps, cancelable permanent-delete confirmation, and modal mobile navigation focus/import handoff. A final exact-source mock comparison-verb regression also passes. See [stable findings, diff sizes, checks and commits](sol-loop.md).

## Visual evidence

Captured and parent-inspected desktop 1440×900, tablet 768×1024, mobile 390×844: actual published PDFs, authored verification PDFs, dialogs, source alignment, library drawers and manual Hindi bindings. [Screenshot manifest](../artifacts/release-screenshot-manifest.json) records 12 image hashes, viewports, build and source identity. Both light/dark comparison screenshots were inspected. Chromium viewport checks do not establish Firefox/Safari, real-device or assistive-technology support. The Hindi screenshot is explicitly a manual protocol fixture, not generated translation quality.

## Add these keys and settings

The template Infisical login was verified; no visible project belonged to this app and no unrelated secrets were read. Create/authorize this app's Infisical project/environment/folder, select `INFISICAL_PROJECT_ID`, `INFISICAL_ENV`, `INFISICAL_SECRET_PATH`, and inject into the process using the command in README. Untracked `.env.local` is the documented alternative.

| Purpose                     | Exact configuration                                                                                                     | Where                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Clerk browser/server        | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`                                                                 | Next build AND startup via Infisical/env                                                       |
| Clerk/Convex trust          | `CLERK_JWT_ISSUER_DOMAIN`, Clerk JWT template named `convex`, `ALLOW_LOCAL_AUTH=false`                                  | Convex environment and Clerk dashboard; remove local app mode for hosted use                   |
| Real generation             | `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`                                                              | App server process; OpenAI/OpenRouter host-correct aliases are supported                       |
| Real embeddings             | `EMBEDDING_MODEL`; `EMBEDDING_BASE_URL`/`EMBEDDING_API_KEY` when separate                                               | App server; model must produce 256 dimensions. Different provider origin requires separate key |
| Custom provider/cache       | `LLM_TRUSTED_HOSTS` for custom HTTPS hosts; `LLM_PROMPT_CACHE=anthropic` only for supported OpenRouter Anthropic models | Server deployment settings, optional                                                           |
| More open-access resolution | `UNPAYWALL_EMAIL`                                                                                                       | Optional server contact setting                                                                |

Crossref/arXiv need no API keys; Semantic Scholar is not required by this implementation. Offline/mock mode needs no paid keys. Do not publish credentials or reuse unrelated Infisical projects.

## Preserved data and cleanup

Fresh private snapshot: `.data/backups/2026-11-10T17-11-32.382Z-64ba0290/snapshot.zip`, SHA-256`cdbcb691287a9c7bd0102830e5dfbbb49517e68418765ab787e46827d69a2aed`. The timestamped snapshot and manifest were copied to the workstation's private evidence backup folder with files set to `0600` and the directory set to `0700` and independently verified. Current state: 1 paper, 15 pages, 1 PDF, 1 index manifest, and 79 chunks; 0 collections, annotations, glossary entries, messages, or upload claims. 134 historical orphan cache manifests from early test runs were removed through a local cache-only replacement; the current logical manifest remained byte-for-byte unchanged and a pre-cleanup snapshot is retained. No application code changed for that maintenance. Full database/file restore remains untested.

The box stays RUNNING and intact for inspection. Parent-owned Next/Convex and test-owned browsers/servers are stopped; loopback ports 3000/3001/3210/3211 are verified closed. Restart with `bun run local` as documented in [operations](operations.md). No autostart was added and no unrelated service was stopped.

## Known limitations

Real Clerk sign-in/out, paid-provider semantics, generated Hindi/Telugu/Marathi translations and true simplification were not verified without keys. Figure/equation explanations use extracted text/captions, not a vision model; layout/bibliography/math extraction is heuristic. Large-library throughput was not benchmarked. Full restore and GitHub-hosted manual CI were not run. P2 deferrals are reading ruler/history; OCR; EPUB/HTML/SyncTeX/ink/editing/presentation; batch/smart collections/extensions/collaboration; RIS/CSL/Zotero sync; forward/retraction/influence graphs; TTS/vocabulary analytics/Anki; PWA/background sync/full chrome localization/worker queues. These exclusions are explicit in FEATURES.md.
