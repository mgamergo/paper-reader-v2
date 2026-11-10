# Frontend implementation reference

The frontend consumes the Zod schemas in `lib/domain.ts` and the authenticated Next API. The frontend has no second database and does not fabricate assistant responses. Implementation does not establish browser acceptance. The parent owns integrated browser verification and the FEATURES checklist.

## Files

| File                            | Responsibility                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `app/page.tsx`                  | Workspace entry point.                                                                                                |
| `app/layout.tsx`                | Metadata, global CSS, conditional ClerkProvider. A missing publishable key leaves local mode usable.                  |
| `app/globals.css`               | Blue-ink themes, responsive reading desk, PDF text layer, annotation overlays, focus and reduced motion.              |
| `components/workspace.tsx`      | Library loading, active documents, split readers, settings persistence, page persistence, selection actions, dialogs. |
| `components/library.tsx`        | Search, sort, collections, tags, metadata editor, deletion, PDF upload and source import.                             |
| `components/pdf-reader.tsx`     | Browser-only pdf.js v6 canvas and TextLayer, navigation, outline, thumbnails, search, reference previews.             |
| `components/pdf-text.ts`        | Text-run index with DOM Range mapping for actual glyph search and citation hotspots.                                  |
| `components/learning-pane.tsx`  | Bilingual learning, scoped chat, retrieval details, annotations, glossary, flashcards.                                |
| `components/command-center.tsx` | Searchable commands, help, shortcut recording, conflicts, reset.                                                      |
| `components/ui/primitives.tsx`  | Radix dialogs, tooltips and popovers, hover and focus previews, button variants, loading and errors.                  |
| `hooks/use-shortcuts.ts`        | Global key listener with modal, typing, composition and platform guards.                                              |
| `lib/client.ts`                 | HTTP requests, Zod response parsing, safe links, upload progress and API errors.                                      |
| `lib/shortcuts.ts`              | Default bindings, normalization, matching and remap validation.                                                       |
| `lib/export.ts`                 | Escaped BibTeX, annotation Markdown, browser downloads.                                                               |
| `tests/unit/shortcuts.test.ts`  | Binding coverage, Mod platform behavior, Shift, conflicts, input isolation, search exceptions, modified plus.         |
| `tests/unit/export.test.ts`     | BibTeX escaping and fields, Markdown ordering, ownership filtering, multiline quotes.                                 |

## Implemented behavior

The library searches titles, authors and DOI. Papers sort by addition date, title or publication year. Collection and tag filters combine with search. The library supports collection creation and deletion, metadata and membership editing, and confirmed paper deletion. PDF uploads accept files up to 25 MB and display actual upload-byte progress. Metadata extraction and indexing use an indeterminate state. DOI, arXiv ID and public-URL imports use the same server endpoint.

The reader loads bytes from `/api/papers/:id/pdf`. `getDocument`, `PDFPageProxy.render`, and the v6 `TextLayer` render the PDF and selectable text. Near-page rendering releases offscreen canvases. The reader supports continuous and single-page modes, page input, previous and next, zoom, fit width, fit page, rotation, a progress indicator, outline and lazy real thumbnails. Inferred headings use the ingestion font-size data if the outline is absent. Split readers keep independent page, zoom, fit and rotation state. The selected split controls the learning pane.

PDF search maps matches back to DOM ranges and draws visible glyph rectangles. Enter and Shift+Enter cycle matches inside the PDF search field. Selection, double-click and right-click retain actual PDF text, its page, page-coordinate rectangles and surrounding paragraph context. Text highlights retain page coordinates through zoom and rotation. Notes, comments, tags, bookmarks, editing, deletion and exports use server persistence.

Citation hotspots use real text ranges. Numeric citation groups and ranges offer a work selector. Author-year and Unicode superscript citations resolve against the extracted bibliography. Unresolved citations show an explicit fallback. Metadata cards open on hover or focus. ArrowDown moves from a trigger into the preview. Cards contain metadata, source links and import state. Cited PDFs use the ownership-checked reference preview proxy only when `pdfUrl` exists. Ingested cited papers can use their owned PDF endpoint. Figure, table and named equation references preview the actual original page and extracted caption context.

Learning actions include Explain, Define, Summarize section, Translate, Find related papers, Simplify, Explain equation and Explain figure. Requests carry the actual selection and paragraph context. The default language includes Hindi, Telugu, Marathi and additional languages. The difficulty slider and answer-language regeneration retain the request context. Answers show separate English and translation blocks, provider names, refusals, contextual term links, glossary saves, response copying and explanation notes. An absent translation is shown as unavailable. Offline providers are labeled, including their language-quality limits.

Document and collection chat load persisted history. Every answer sentence renders its source citations. Citations open the relevant owned paper, jump to its page and flash the source rectangles. Retrieval details show queries, HyDE, filters, stages, passage text, parent context, scores and ranks. Scope controls can restrict sections and passage kinds or include already-ingested cited papers.

The glossary supports search, editing and deletion. Flashcards reveal definitions before grading. Grades persist `dueAt`, `interval` and `repetitions`; failed recall returns after ten minutes. Glossary entries created from terms do not invent a term translation because the answer contract supplies a whole-answer translation only.

Every FEATURES keyboard command has a palette entry and a help entry. Remaps persist through settings and reject conflicts. Global remaps require Mod or Alt to protect typing. Escape remains reserved for dismissal. Shortcuts pause in inputs and editable content except explicit globals and PDF-search-only commands. Radix owns modal focus trapping and Escape. Modal close restores the originating focus target. The mobile workspace switches between reading and learning; split readers stack at narrower widths. Light, dark and sepia chrome leave original PDF colors intact unless page tinting is explicitly enabled.

## API usage

| Method and route                                   | Frontend use                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/library`                                 | Papers, collections, glossary and settings.                                   |
| `POST /api/import`                                 | Multipart `file` or JSON `{source}`.                                          |
| `PATCH /api/papers/:id`                            | Metadata, collections, tags, page and progress.                               |
| `DELETE /api/papers/:id`                           | Confirmed deletion.                                                           |
| `GET /api/papers/:id/pdf`                          | Original PDF rendering and download.                                          |
| `POST /api/papers/:id/reindex`                     | Retry indexing; refresh status afterward.                                     |
| `GET /api/annotations?paperId=`                    | Saved annotations.                                                            |
| `POST /api/annotations`                            | Create or update a complete annotation, retaining its ID during edits.        |
| `DELETE /api/annotations/:id`                      | Delete annotation.                                                            |
| `GET /api/chat?paperId=`                           | Document history; collection history uses `collection:<id>`.                  |
| `POST /api/assist`                                 | Domain AssistRequest and RagAnswer.                                           |
| `POST /api/collections`                            | Create collection.                                                            |
| `DELETE /api/collections/:id`                      | Delete collection while retaining papers.                                     |
| `POST /api/glossary`                               | Save contextual term with client UUID and timestamps.                         |
| `PATCH /api/glossary/:id`                          | Edit term or review schedule.                                                 |
| `DELETE /api/glossary/:id`                         | Delete term.                                                                  |
| `PATCH /api/settings`                              | Serialized preferences and shortcut updates.                                  |
| `GET /api/references?paperId=&referenceId=`        | Resolve stored reference metadata with raw fallback.                          |
| `GET /api/reference-preview?paperId=&referenceId=` | Ownership-checked cited PDF bytes. Called only when a reference has `pdfUrl`. |

All JSON responses pass through the domain schemas. Non-2xx errors use `{error:string}`. The frontend never fetches arbitrary reference PDF URLs. HTTP and HTTPS links are allowed as explicit external navigation.

## Verification and limits

The latest shortcut and export run passed 11 tests with 77 assertions. Scoped ESLint and Prettier checks passed for the owned frontend. The default whole-project typecheck reported missing implicit Bun types. With `bunx tsc --noEmit --types bun,node`, the last observed errors were outside the owned scope: `tests/integration/ownership.test.ts` lines 37 and 39 call unavailable `setAdminAuth`, and `tests/integration/storage.test.ts` line 124 widens a chat role to `string`. No owned frontend type errors were reported.

No package was installed. No service, browser or subagent was started. No Git mutation was made.

The parent reported a 1280×720 screenshot with clipped icon-plus-text import buttons. The cause was `.button:has(>svg:only-child)`, which also matched an SVG followed by a text node. Fixed sizing now targets the explicit `.icon-button` class. The parent must verify the fix visually.

Browser behavior, responsive screenshots, focus order, actual PDF selection and rotated overlays, reference previews, chat persistence and flashcard scheduling still need integrated verification. These features are not marked verified in FEATURES.

Inline reference recognition remains heuristic. Unusual author-year syntax, bare equation numbers and citations split in unexpected extraction order can remain unresolved. Figure and table previews show the source page rather than an inferred image crop. Multi-page selections are not supported. Search depends on extracted text order; scanned documents show an OCR notice. Page saves debounce for 650 ms and use best-effort keepalive on page exit. Browser shutdown can still interrupt network persistence. No browser checks establish Firefox, Safari or real-device support.

A Sol review was not run because the task explicitly forbids subagents. The parent owns the required independent reviews.
