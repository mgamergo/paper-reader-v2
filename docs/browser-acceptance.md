# Browser acceptance reference

Final complete run: **19 tests, 15 passed, 4 failed, 0 skipped, 0 flaky**, 83.63 seconds, exit 1. Whole-project formatting, lint and type checking passed. No unexpected console, page, failed-request or HTTP diagnostics occurred in that final run. A three-case focused rerun also passed before the final full run. Application fixes remain with the parent.

All code authoring and tests used the existing boxes.dev instance `0e09ad54-c2a4-4c19-8e9b-2d80fca789a4`, project `55820d6f-3b36-4755-a698-99a26f8ca460`, cwd `/home/boxes/repos/paper-reader-v2`, through workstation `/data/workspace/reader-v2-box`. No previous reader project, subagent, installation, Git mutation, application edit or server lifecycle change was used.

## Commands and build identity

Run these commands inside the remote project through the workstation wrapper. Keep the parent-owned production Next and Convex servers running.

```bash
bun run format:check
bun run lint
bun run typecheck
INSTABOX_HEADLESS=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 bun run test:e2e --workers=1 --output=artifacts/e2e-test-results
```

The three checks passed. Playwright 1.65.0 used one Chromium worker with strict diagnostics attached before navigation. Main reader tests start at 1440x900; responsive checks sequentially use 1440x900, 768x1024 and 390x844. No network responses were intercepted. There are no diagnostic exclusions or skipped cases. Shortcut conflict validation is client-side. No package script was missing. This acceptance agent did not run unit/integration suites or rebuild the parent's frozen server.

Initial source HEAD was `eaf34e6bb1d55c8965fdda108a1b0e3aff8556e7`. Final checked source HEAD was `dee1be703abaa50e71685f6553ffc25f9482280a`, with parent changes present. Production stayed frozen at build ID `h7XXWWNLK3-41qOS4mYjI`; its original build included then-uncommitted RAG/API integration. These browser results prove that artifact, not a fresh build of final HEAD. `artifacts/acceptance-run-metadata.json` records the command and working tree.

Parent-added optional `sentence.translation`, `answer.language`, and `term.citations` fields and paired native-language citations are **not browser-verified**. The production artifact did not contain those source changes.

## Changed files and fixture ownership

Authored `tests/e2e/acceptance-support.ts`, `tests/e2e/acceptance.spec.ts`, `tests/e2e/edge-flows.spec.ts`, `tests/e2e/source-and-scope.spec.ts`, this report and bounded `artifacts/e2e*` / `artifacts/acceptance-*` evidence. Replaced exploratory `smoke.spec.ts` and `read-baseline.spec.ts`. Reused strict `fixtures.ts`. No application, backend, domain, package, configuration or fixture PDF file was edited.

Tests derive distinct original PDFs in memory with pdf-lib from `tests/fixtures/reader/contextual-reading.pdf`. PDF uploads and source imports use the UI and actual bytes. Returned IDs drive state assertions and cleanup. Collection membership and one explicitly seeded glossary entry use real API setup. No provider output or published metadata is invented.

The empty-library test refuses to delete unrelated papers. It requires the task-owned library containing only the explicitly authorized Attention Is All You Need source. It fails this precondition instead of silently skipping or deleting other data. Source tests may temporarily remove that paper and restore it with a new returned ID. No fixed ID is assumed.

## Passed behavior

| Area              | Assertions completed                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library           | Actual PDF upload, returned two-page text/ready state, library state, true empty state, no-match search, title/author search, title-sort control selection, tag filtering, metadata persistence, collection creation/membership/deletion, confirmed paper deletion. |
| Reader            | Real mouse-selected text and clipboard copy, continuous/single-page rendering, input/previous/next, persisted page and resume, zoom and fit-page dimensions, rotation, inferred outline destination, actual thumbnails and page jumps.                              |
| Search            | Visible glyph match rectangles, count/current match, next/previous buttons, Enter/Shift+Enter, no-match rectangle removal.                                                                                                                                          |
| Annotations       | Green/pink highlights with source rectangles, comments/tags, bookmark, highlight-to-note edit, reload persistence, search/delete, actual Markdown and BibTeX downloads with content assertions.                                                                     |
| Assistance        | Drag-selection context/page, Explain action, Telugu default, Marathi override, difficulty 4, simplify action request, offline provider label and honest translation absence. Double-click/right-click reaches the actual menu but exposes the context bug below.    |
| Grounding/debug   | Actual attention-weighting answer, out-of-paper stock-price refusal, document follow-up/history after reload, citation page jump and visible source rectangles, actual hit ranks/rectangles, RRF stage and expanded score/rank table.                               |
| Glossary/review   | Source-text-seeded entry, UI edit/search/delete, hidden definition before reveal, Good grading, two-day interval, due date, repetitions and reload persistence. This does not prove explanation-to-glossary save.                                                   |
| Citations         | Hover metadata, keyboard focus, title/author/year/source link, actual cited PDF ink pixels, fresh citation Add to library, arXiv UI import/deduplication, real source title/authors/15 pages/42 references and actual PDF bytes.                                    |
| Internal previews | Figure/table actual canvas ink and original-page jumps. Equation remains failing.                                                                                                                                                                                   |
| Split/scope       | Independent reader page/zoom, actual collection request scope and owned citations, persisted collection history, document-history isolation.                                                                                                                        |
| Keyboard/comfort  | Searchable palette, first/last page, help, conflict rejection, remap activation/reload persistence, typing isolation, j/k scrolling, light/dark/sepia persistence, tint opt-in, focus mode.                                                                         |
| Responsive        | Root overflow and retained page on resize, usable controls, modal horizontal bounds/focus trap/focus restoration, reduced motion, tablet/mobile Read and Learn/chat switches with grounded questions.                                                               |

## Reproduced failures

1. **P0: same-origin browser writes fail at 127.0.0.1.** Open `http://127.0.0.1:3000`, Add paper, select the authored PDF and submit. `/api/import` returns 403 with `Cross-origin writes are not allowed.` Browser HTTP/console diagnostics fail. Matching-origin writes at `localhost` work, so the suite uses that base URL. A non-mutating minimal repro is POST `/api/import` with `{}` and matching Origin: 403 at 127.0.0.1, validation 400 at localhost. Next origin normalization interacting with the `request.url` comparison in `lib/server/api.ts` is the inferred cause. Evidence: `artifacts/e2e-origin-run.log`, `artifacts/e2e-origin-failure/`. This is additional to the four final test failures.
2. **P0: wrong context for double-clicked repeated term.** In the authored abstract, double-click Attention, right-click and Explain. The outgoing request has the selected term and page 1 but context `ontextual Reading and Attention`, from the title. Expected context contains `Attention is a mechanism ...`. `paragraphContext` uses the first `indexOf(text)` and its absent-boundary slice also drops the first character. Evidence: `artifacts/e2e-assist-selection.json`, double-click trace. The passing full-sentence drag request is separately saved as `artifacts/e2e-assist-selection-drag.json`.
3. **P0 coverage blocker: no explanation-to-glossary save under the mock.** Explain the real attention definition. The answer is grounded but `terms` is empty, so no Save term button exists. `lib/rag/mock.ts` deliberately returns `terms: []`. The acceptance assertion remains failing. This is a provider/product limitation, not failed retrieval. The separately seeded glossary case must not be counted as proof of the missing save flow. Evidence: `artifacts/e2e-assist-glossary.json`, glossary-save trace.
4. **P0: equation reference lacks a preview.** The fixture has `Eq. (1)` and the actual formula ending `(1)`, but no accessible Preview Eq trigger. Current internal-target matching requires a span beginning Eq/Equation and does not recognize that numbered formula. Figure/table previews pass separately. Evidence: equation-preview trace and accessible snapshot.
5. **P0: deleted cited work remains marked ingested.** Upload the authored paper while Attention Is All You Need is in the library. Delete the explicitly authorized cited paper, reload the authored paper and focus citation [1]. Actual library state lacks the target, but the card says In your library and has no enabled Add to library action. Stored `ingestedPaperId` survives deletion in `convex/workspace.ts`. The test restores readable source bytes in finally. A fresh authored fixture uploaded after removal independently passes actual citation import. Evidence: stale-citation trace.

## Diagnostics and evidence

All four final failures are acceptance assertions. No console, page-error, failed-request or HTTP-error exclusion was used. Earlier aborts during scope/reference transitions were resolved in the test by waiting for specific history responses and keeping focus inside the citation card until its actual bitmap rendered. An intermediate screenshot showed a hover card had closed; that did not prove a permanently blank PDF. Both the focused rerun and final full run pass the stronger ink-pixel check. An invalid intermediate test-boundary edit was repaired and type/lint checked before the final run. The final report was read back after correcting a heredoc delimiter collision. Intermediate runs are not final acceptance evidence.

| Evidence                                           | Location                                                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Final complete result and log                      | `artifacts/e2e-results.json`, `artifacts/e2e-run.log`                                                                      |
| Four retained failure traces/screenshots/snapshots | `artifacts/e2e-test-results/`                                                                                              |
| Focused rerun                                      | `artifacts/e2e-focused-results.json`, `artifacts/e2e-focused.log`                                                          |
| Actual assist request/response bodies              | `artifacts/e2e-assist-*.json`                                                                                              |
| Source/build identity                              | `artifacts/acceptance-run-metadata.json`                                                                                   |
| Cleanup state, settings, restored PDF hash         | `artifacts/acceptance-cleanup.json`, `artifacts/e2e-cleanup-*.json`                                                        |
| Project checks                                     | `artifacts/e2e-format-check.log`, `artifacts/e2e-lint.log`, `artifacts/e2e-typecheck.log`                                  |
| Desktop/tablet/mobile reader                       | `artifacts/acceptance-desktop.png`, `artifacts/acceptance-tablet.png`, `artifacts/acceptance-mobile.png`                   |
| Matching metadata modals                           | `artifacts/acceptance-desktop-modal.png`, `artifacts/acceptance-tablet-modal.png`, `artifacts/acceptance-mobile-modal.png` |
| Tablet/mobile chat                                 | `artifacts/acceptance-tablet-chat.png`, `artifacts/acceptance-mobile-chat.png`                                             |

Desktop, tablet, mobile and mobile modal screenshots were transferred and inspected. Chrome controls and metadata fields fit without root overflow. At mobile fit-width, PDF text is small and requires zoom. Screenshots complement assertions; neither a screenshot nor HTTP 200 alone counts as a completed user flow. Chromium viewport checks do not establish Firefox, Safari, real-device or external Clerk support.

## Cleanup

Final cleanup passed. One real Attention Is All You Need paper remains with 15 extracted pages and readable 2,215,244-byte PDF bytes. Final returned ID is `e86f075b-f064-4c09-8031-80da98432f8c`; future tests do not depend on it. Its SHA-256 is `bdfaa68d8984f0dc02beaca527b76f207d99b666d31d1da728ee0728182df697`.

There are no test papers, collections or glossary entries left. Deleting owned papers cascaded their annotations and document chats. Per-test comparisons verified settings restoration. Final settings are Hindi, light, difficulty 2, continuous mode, no page tint and no shortcut overrides. Collection-chat physical row deletion is not verified. Source inspection of convex/workspace.ts deleteCollection shows no messages deletion; paper deletion targets document IDs, while these chat rows use collection:<id>. Possible orphaned collection chat rows need parent inspection/cleanup. The final tested scope is recorded in acceptance-cleanup.json. No arbitrary DB cleanup was attempted. No browser processes remain. Next and Convex listeners remain running. The agent started no test server. See the cleanup JSON for the final state.

## Original P0/P1 acceptance still incomplete

No FEATURES checkbox was changed. A passed mechanics test is not acceptance of every checklist row.

- DOI/public-URL imports, drag/drop, import size/scan/error/retry states and noncached-source deduplication remain untested. No unavailable external response was fabricated.
- Sort control selection is asserted, but ordering across multiple papers and year sorting are not. Full metadata-field coverage, collection renaming and provenance display need more assertions.
- Source rectangles persist and render, but exact glyph alignment after zoom/rotation and numerical comparison of source-flash DOM rectangles with every returned citation rectangle remain untested. Not every highlight color/tag-edit combination or fit-width resize behavior is covered.
- Export content is asserted, but full BibTeX parsing/escaping permutations are not browser-tested.
- Numeric groups/ranges, author-year, superscript, unresolved/fallback and metadata-error citation states need dedicated authored cases. Full abstract/venue content, touch interaction and complete preview keyboard traversal are not asserted.
- Cross-paper source jumps, retrieval section/kind filters and expanded-citation scope need browser cases.
- Real Hindi/Telugu/Marathi translation and simplification quality, paired native citations, glossary duplicate prevention and all recall grades remain unverified. The mock proves request mechanics and honest translation absence; its source save-term limitation remains failing. New optional translation/citation fields are absent from the frozen artifact.
- Define, overview, contributions/methods/limitations, Summarize section, Translate, Find related papers, equation/figure explanations, response copy and explanation-to-note save need dedicated completed assertions.
- All shortcut commands, global remaps, input/global/search exceptions, import-dialog responsive bounds, vertical modal scrolling, screen readers and a full keyboard-only flow are not exhaustively covered.
- Backend/RAG evaluation results belong to the parent and do not substitute for these browser assertions. No fresh build, other browser engine or external Clerk sign-in was verified here.
