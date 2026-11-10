# Extended browser acceptance handoff

Authored inside box `0e09ad54-c2a4-4c19-8e9b-2d80fca789a4` on 2026-11-10. This handoff adds tests, not browser results. No browser, package installation, application edit, service change, Git mutation or subagent was started by this worker.

The parent must execute the new tests against its fresh production build. None of these cases has been browser-run by this worker. Existing acceptance results do not establish these cases.

```sh
INSTABOX_HEADLESS=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 bun run test:e2e tests/e2e/extended.spec.ts --workers=1 --output=artifacts/e2e-extended-results
```

All authoring/checks used `dvb exec` through `/data/workspace/reader-v2-box`, remote repo `/home/boxes/repos/paper-reader-v2`. Scoped Prettier, scoped ESLint with zero warnings and whole-project strict TypeScript passed after the final edit.

## Added cases

Twelve cases in `tests/e2e/extended.spec.ts`, with `tests/e2e/extended-support.ts`:

1. arXiv DataCite DOI and public PDF URL import against actual cached source bytes, title/authors/text/PDF assertions, deduplication and owned cleanup.
2. An actual DataTransfer/File drag/drop onto the PDF import zone, then indexed/readable state and library persistence.
3. Invalid extension and >25 MB client rejection, disabled submit and zero import requests.
4. Invalid source and blank/image-only PDF server rejection, actionable UI errors and successful retry with valid actual PDF bytes.
5. Original authored citation fixture containing numeric groups/ranges, author-year, geometrically raised superscript and unresolved reference; group selection identity, metadata and disabled unresolved import assertions.
6. Actual highlight save then glyph/overlay geometric intersection after zoom and 90° rotation, using text-layer DOM bounds rather than duplicating the application's transform function.
7. Real service Define, Summarize section, Translate, Find related papers, Explain equation and Explain figure request mechanics and source-support/refusal checks; actual clipboard text and persisted explanation note with selection rectangles.
8. Actual section/kind/graph-expansion request filters, nonempty constrained returned chunks and displayed debug filter state.
9. Reader shortcut commands for navigation, outline, thumbnails, fit/zoom/mode, glossary/review/chat, input isolation, global search/import and focus mode.
10. An explicitly labeled manual Hindi **UI protocol fixture** derived from an actual grounded English response. Verifies paired native citations, source flash, stable answer language after preference change, source-linked glossary translation save and persistence. This uses one narrowly scoped route transformation and proves UI bindings only; it does not prove generated Hindi/model quality. The provider label says so.
11. Tablet/mobile import dialog bounds, reachable submit, focus trap, Escape restoration and no root overflow.
12. Remapped Alt+q dismissal across help/import dialogs, physical Escape fallback, persisted remap after reload and paper-details dismissal.

The original generated citation PDF is an authored test fixture, never labeled a published paper. Its second bibliography entry is explicitly an original verification fixture. The published Attention PDF and metadata remain actual cache bytes. No unavailable external metadata or generated semantic quality is fabricated.

## Parent attention

- Case 4 uses `diagnostics.allowHttp(/\/api\/import$/, 400)` for deliberate validation responses only. The shared diagnostics fixture still records every console error unconditionally. If Chromium emits its standard resource-error console message for the declared 400, parent should allow only the exact console location/status paired with a declared HTTP allowance. Do not blanket-ignore console failures.
- Equation and figure assistance currently select the source attention definition to prove action/context wiring. This does not establish equation derivation, image understanding, translation, simplification or real-model correctness; those require a configured provider and a semantic review.
- The scoped filter case requires an Introduction text chunk from the original reader fixture. If this fails, inspect chunk classification/section ancestry rather than weakening the nonempty or matching-kind/path assertions.
- The authored superscript uses a small raised ASCII 2 beside prose, exercising geometry rather than depending on a Unicode font substitution.
- The numerical overlay check requires at least 90% of the highlight area to overlap the selected glyph run after the transformation. It complements original persisted PDF coordinate assertions. The suite does not claim raster OCR alignment or all PDF layout correctness.
- The shortcut reset/zoom assertions use outcomes, including approximate numeric equality after reciprocal zoom changes. No browser-specific floating-point serialization is required.
- New tests clean up only returned IDs they create and restore settings through the existing owned fixture. Published source import cases preserve an existing source and delete only a source absent before their run. They never delete unrelated library data.
- Full-library sorting across multiple documents, every flashcard grade, every shortcut remap and every metadata-field permutation remain separate unit/integration or future coverage; no exhaustive browser claim is made.
