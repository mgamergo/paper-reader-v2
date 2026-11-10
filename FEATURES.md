# Features and verification checklist

This reader helps people who read research in a second language understand a term in its sentence, field, and paper, then remember it. Bilingual explanations, preserved technical vocabulary, and reusable flashcards are the product edge. A generic PDF chat is insufficient.

Status: `[ ]` pending, failed, or deferred; `[x]` implemented and verified within the documented local/offline scope. A partial implementation remains unchecked. P0 and P1 are release gates. Provider mocks prove mechanics, not real-model quality. Translation, simplification, generated contextual prefixes, learned embeddings and real Clerk sign-in still require the keys and live acceptance listed in README. Native sentence/citation/glossary bindings additionally pass an explicitly manual Hindi UI protocol fixture. Research reviewed 2026-11-10, time-boxed to about 20 minutes. The Notion page was unavailable over public fetch; the complete user-supplied text is the source of requirements.

## Reader, navigation, and reading comfort

| Status | Priority | Feature and acceptance detail                                                                         | Why / inspiration                                     |
| ------ | -------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [x]    | P0       | Render actual PDFs with pdf.js, selectable text layer, copy, text search, coordinate-bound highlights | Essential reading integrity; Zotero, Acrobat          |
| [x]    | P0       | Continuous and single-page modes, page number input, previous/next, zoom, fit width/page, rotate      | Stay oriented in technical layouts; Zotero, Skim      |
| [x]    | P0       | Light, dark, sepia chrome; opt-in page recoloring that preserves original figures by default          | Eye comfort without destroying chart colors; Zotero 7 |
| [x]    | P0       | Outline with page jumps, inferred headings when absent, real page thumbnails                          | Navigate long PDFs; Sioyek, Skim                      |
| [x]    | P0       | In-document search with visible matches, result count, next/previous, Enter/Shift+Enter               | Find actual text; Acrobat                             |
| [x]    | P0       | Persist page/progress per document and resume on reopen                                               | Interruptible reading; Readwise Reader                |
| [x]    | P0       | Split two different papers, independent page/zoom controls                                            | Compare methods; Zotero split view, Sioyek portals    |
| [x]    | P0       | Hover and keyboard-focus previews for figure/table/equation references, linked to original location   | Avoid losing place; Semantic Reader, Sioyek           |
| [x]    | P0       | Command palette with searchable actions and current bindings; remappable shortcuts; ? help            | Discoverability and expert speed; Sioyek, Readwise    |
| [x]    | P1       | Focus mode, accessible toolbar names, reading progress indicator, loading/error/retry states          | Keep paper central; Skim, Readwise                    |
| [x]    | P1       | Mobile reading/assistant tabs, touch controls, no clipped dialogs or document controls                | Small-screen continuity; Paperpile mobile             |
| [ ]    | P2       | Reading ruler and persistent navigation history                                                       | Line focus and return paths; Skim, Sioyek             |
| [ ]    | P2       | OCR for scanned PDFs with explicit unsupported-scan state until available                             | Never pretend empty text was ingested; Acrobat        |
| [ ]    | P2       | EPUB, HTML, SyncTeX, pen ink, freehand drawings, PDF editing, presentation mode                       | Adjacent workflows; Zotero, Sioyek, Kami, Skim        |

## Library, imports, and annotations

| Status | Priority | Feature and acceptance detail                                                                                          | Why / inspiration                                       |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [x]    | P0       | Library with collections, tags, metadata, title/author search and sorting                                              | A durable research workspace; Papers, Paperpile, Zotero |
| [x]    | P0       | Import PDFs by upload and drag/drop with bounded size, progress and actionable errors                                  | Low-friction ingestion; Explainpaper, Kami              |
| [x]    | P0       | Import DOI, arXiv ID and public URL, resolve metadata and open PDFs when available                                     | No manual download hunt; Paperpile, Papers              |
| [x]    | P0       | Extract title/authors/DOI/abstract/year/venue via PDF parsing plus Crossref/arXiv, optional Semantic Scholar/Unpaywall | Reliable attribution; Zotero, Semantic Scholar          |
| [x]    | P0       | Multicolor text highlights, notes/comments, tags, bookmarks, edit/delete and persistence                               | Record understanding; Zotero, Kami                      |
| [x]    | P0       | Export annotations as Markdown and metadata as valid escaped BibTeX                                                    | Own your research; Zotero, Paperpile, Readwise          |
| [x]    | P1       | Duplicate import detection and visible source/provenance                                                               | Avoid library clutter; Papers                           |
| [x]    | P1       | Collection management, paper metadata editing and safe deletion                                                        | Keep library useful beyond demos; Paperpile             |
| [ ]    | P2       | Batch imports, saved searches, smart collections, browser extension, collaborative annotations                         | Scale and social research; Papers, Paperpile, Kami      |
| [ ]    | P2       | RIS/CSL-JSON export, Zotero synchronization, reference-manager integrations                                            | Interoperability; Zotero, Paperpile                     |

## Citation understanding

| Status | Priority | Feature and acceptance detail                                                                             | Why / inspiration                                              |
| ------ | -------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [x]    | P0       | Parse bibliography and link numeric citations/ranges, author-year and superscripts; show unresolved state | Citation literacy without losing place; Semantic Reader        |
| [x]    | P0       | Hover/focus cards show cited title/authors/year/abstract/venue/link with metadata-loading/error states    | Verify claims in context; Semantic Reader, Papers              |
| [x]    | P0       | Preview available cited PDF or landing-page metadata; show unavailable preview honestly                   | Inspect cited document before navigating; Semantic Reader      |
| [x]    | P0       | One-click add cited work to library with import status and deduplication                                  | Follow evidence trails; Papers                                 |
| [x]    | P1       | References panel searchable by title/author and linked back to passage                                    | Navigate dense bibliographies; Sioyek                          |
| [ ]    | P2       | Forward citations, citation influence, retraction alerts and connected-paper graph                        | Broader literature context; Semantic Scholar, Elicit, alphaXiv |

## Contextual learning and assistance

| Status | Priority | Feature and acceptance detail                                                                                                                  | Why / inspiration                                               |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [x]    | P0       | Select/double-click actual PDF text; selection and right-click menu include Explain, Define, Summarize section, Translate, Find related papers | Resolve language friction at its source; Explainpaper, SciSpace |
| [x]    | P0       | Explain uses selection, surrounding sentence/paragraph and paper RAG; show field and cited context                                             | Avoid wrong dictionary meaning; Notion positioning              |
| [x]    | P0       | English with Hindi, Telugu, Marathi and additional languages; saved default and per-answer override                                            | Support native-language understanding; SciSpace, Notion         |
| [x]    | P0       | Paragraph difficulty slider preserves technical terms and links them to contextual definitions                                                 | Simplify syntax without erasing science; Notion                 |
| [x]    | P0       | Save contextual glossary entries, prevent accidental repeats, edit/delete/search                                                               | Stop looking up the same term; Notion, Readwise                 |
| [x]    | P0       | Flashcards with reveal, graded recall and persisted spaced review schedule                                                                     | Retain terminology; Notion, Readwise                            |
| [x]    | P0       | Paper overview with summary, contributions, methods, limitations and glossary; citations for claims                                            | Orient before deep reading; Elicit, alphaXiv, SciSpace          |
| [x]    | P0       | Explain equations and figures using actual caption/section evidence, distinguish visual limits                                                 | Understand technical content; SciSpace, Semantic Reader         |
| [x]    | P1       | Suggested questions, persistent follow-ups, copy response and save useful explanations                                                         | Continue reading productively; Acrobat AI, alphaXiv             |
| [x]    | P1       | Reproducible feature-demo guide for future 15–30s clips; no social posting                                                                     | Build-in-public readiness; Notion                               |
| [ ]    | P2       | Read-aloud/TTS with native pronunciations, vocabulary statistics, Anki export                                                                  | Additional learning channels; Kami, Readwise                    |

## Advanced retrieval and grounded generation (all P0)

| Status | Priority | Feature and acceptance detail                                                                                                 | Why / inspiration                                   |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [x]    | P0       | Layout/section-aware chunks preserve headings, column order, captions, references, source page/coordinates                    | Accurate source recovery; Semantic Reader           |
| [x]    | P0       | Parent-child chunks retrieve small passages and expand parent context without losing child anchors                            | Precise retrieval and sufficient evidence           |
| [x]    | P0       | Real BM25 with configurable and eval-tuned k1/b, corpus document frequency and length normalization                           | Strong lexical baseline                             |
| [x]    | P0       | Separate TF-IDF cosine weighting/ranking, tested independently of BM25 and RRF                                                | Rare technical vocabulary                           |
| [x]    | P0       | Dense vectors, Convex vector index, consistent provider/model dimensions and ownership filters                                | Semantic matching; required stack                   |
| [x]    | P0       | Reciprocal Rank Fusion combines independent BM25/TF-IDF/dense ranks; debug explains contributions                             | Stable heterogeneous ranking; RRF research          |
| [x]    | P0       | LLM-generated contextual prefix includes title, section ancestry and chunk meaning before both lexical indexing and embedding | Anthropic Contextual Retrieval                      |
| [x]    | P0       | Provider prompt caching when supported, no paid-model dependency for offline tests                                            | Bound contextual-indexing cost; Anthropic           |
| [x]    | P0       | Query rewriting, multi-query retrieval and HyDE, distinct logged stages                                                       | Bridge question/terminology mismatch; HyDE research |
| [x]    | P0       | LLM or cross-encoder reranking with constrained outputs and deterministic offline equivalent                                  | Improve final evidence ranking                      |
| [x]    | P0       | Section/kind filters for text/figures/equations/tables/references before retrieval                                            | Control source scope                                |
| [x]    | P0       | Citation-graph expansion only into owned, already ingested cited papers, with provenance                                      | Follow scientific dependencies                      |
| [x]    | P0       | Document and collection Q&A; persisted per-document history and follow-up context                                             | Research across sources; Acrobat Spaces, Elicit     |
| [x]    | P0       | Per-sentence clickable citations jump to and flash exact PDF passage; reject invalid citations                                | Verifiable answers; Acrobat AI                      |
| [x]    | P0       | Explicit 'not in the paper' refusal when evidence does not support answer                                                     | Prevent confident invention                         |
| [x]    | P0       | UI retrieval debug shows queries/HyDE, chunks, scores/ranks and ranking stages                                                | Inspect grounding and diagnose failures             |
| [x]    | P0       | Eval on multiple real arXiv papers with expected answer and passage judgments, negative questions                             | Treat relevance failures as bugs                    |
| [x]    | P0       | Eval recall@k, MRR, nDCG, answer faithfulness; README ablation table for BM25-only/dense-only/hybrid/+contextual/+rerank      | Measure components rather than claim sophistication |
| [x]    | P0       | Faithful deterministic provider and offline fixtures; label synthetic semantics and metric limits                             | Reproducible zero-key checks                        |
| [x]    | P1       | Embedding/index version tracking and reindex path, bounded provider requests and user-facing provider errors                  | Operable beyond a clean demo                        |

## Security, accessibility, and operations

| Status | Priority | Feature and acceptance detail                                                                                                   | Why / inspiration                |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| [x]    | P0       | Next App Router, shadcn/ui primitives, Convex local database/vector/storage, Clerk production auth, Infisical process injection | Required stack                   |
| [x]    | P0       | Strict TypeScript, no explicit any, validated external data and ownership on all data/storage operations                        | Protect reading data             |
| [x]    | P0       | Public-URL import checks, redirect checks, size/time limits; prompt-injection isolation and no client secrets                   | Safe document ingestion          |
| [x]    | P0       | Loopback local mode works with no paid keys; production fails closed without auth configuration                                 | Safe no-key development          |
| [x]    | P0       | Keyboard/screen-reader basics, focus indication, modal focus management, reduced motion                                         | Inclusive reading                |
| [x]    | P0       | Unit/integration/E2E tests, diagnostics attached before navigation, desktop/tablet/mobile inspected screenshots                 | Prove real user flows            |
| [ ]    | P0       | Two sol-loop passes: functionality/RAG/security, then UI/UX; findings ledger and retests                                        | Independent verification         |
| [x]    | P1       | Reproducible setup/start/test commands, CI, data backup/export and missing-key documentation                                    | Maintainable open-source project |
| [ ]    | P2       | Offline PWA, multi-device background sync, localization of all chrome, large-library worker queues                              | Additional operational scale     |

## Keyboard contract

All commands below must appear in the palette and ? cheat sheet. All are remappable, persisted, conflict-checked, and disabled in text inputs/contenteditable except explicit global commands. Mod means Cmd on macOS and Ctrl elsewhere. Escape dismisses transient UI and returns focus. Remapping must not create an unreachable command or silently steal text entry.

| Status | Priority | Default             | Action                                       |
| ------ | -------- | ------------------- | -------------------------------------------- |
| [x]    | P0       | Mod+k               | Command palette                              |
| [x]    | P0       | ?                   | Keyboard shortcuts and remapping             |
| [x]    | P0       | j / k               | Scroll down / up                             |
| [x]    | P0       | g / G               | First / last page                            |
| [x]    | P0       | PageDown / PageUp   | Next / previous page                         |
| [x]    | P0       | / and Mod+f         | Search document                              |
| [x]    | P0       | Enter / Shift+Enter | Next / previous search match in search field |
| [x]    | P0       | + / - / 0           | Zoom in / out / reset                        |
| [x]    | P0       | w / f               | Fit width / fit page                         |
| [x]    | P0       | r                   | Rotate clockwise                             |
| [x]    | P0       | o / t               | Toggle outline / thumbnails                  |
| [x]    | P0       | d / s               | Toggle dark / sepia                          |
| [x]    | P0       | c                   | Open document chat                           |
| [x]    | P0       | e                   | Explain selected text                        |
| [x]    | P0       | h / n               | Highlight selection / add note               |
| [x]    | P0       | b                   | Bookmark page                                |
| [x]    | P0       | l                   | Open personal glossary                       |
| [x]    | P0       | v                   | Review flashcards                            |
| [x]    | P0       | p                   | Toggle continuous/single page                |
| [x]    | P0       | x                   | Toggle split view                            |
| [x]    | P1       | Mod+o               | Import paper                                 |
| [x]    | P1       | Shift+f             | Focus mode                                   |
| [x]    | P1       | Escape              | Close popup/palette/drawer                   |

## Research sources

The rows record observed product capabilities and our resulting design decisions. They do not claim exhaustive hands-on testing of competitors.

- [Zotero reader](https://www.zotero.org/support/pdf_reader) and [official shortcuts](https://www.zotero.org/support/kb/keyboard_shortcuts): text annotations, notes, navigation and tool/color bindings.
- [Papers](https://www.papersapp.com/) and [2025 guide](https://www.papersapp.com/wp-content/uploads/2025/07/Papers-Getting-Started-2025-1.pdf): enhanced reader and reference-library workflow.
- [Semantic Reader](https://www.semanticscholar.org/product/semantic-reader) and [project paper](https://arxiv.org/abs/2303.14334): augmented scholarly reading and citation context.
- [alphaXiv](https://www.alphaxiv.org/): research discussion and assistant context. No community posting in this session.
- [Elicit](https://elicit.com/): literature search, evidence extraction and cited research outputs.
- [SciSpace PDF chat](https://scispace.com/chat-pdf): highlighted explanations, citation-backed answers, related papers and language support.
- [Paperpile](https://paperpile.com/): collect, organize, read, annotate and BibTeX workflows.
- [Readwise navigation](https://docs.readwise.io/reader/docs/faqs/navigation) and [annotations](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes): keyboard-first reading and reusable highlights.
- [Kami](https://www.kamiapp.com/): accessible annotation and multilingual learning workflows.
- [Sioyek](https://sioyek.info/): smart jumps, portals, marks, searchable command palette, configurable keys and ruler.
- [Skim](https://skim-app.sourceforge.io/): snapshots, internal previews, outline/thumbnails, reading bar and note export.
- [Acrobat AI](https://helpx.adobe.com/acrobat/desktop/use-acrobat-ai/generative-ai-features/ai-get-answers.html): exact-source citations, follow-ups and multi-document spaces.
- [Explainpaper](https://www.explainpaper.com/): select confusing prose and request simpler explanations.
- [Anthropic Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval): prepend generated context for both BM25 and embeddings, then rerank.
- [HyDE](https://arxiv.org/abs/2212.10496): hypothetical documents for dense retrieval.

## Acceptance evidence

- Core algorithms, provider protocols, ownership and real Convex storage: `tests/unit` and `tests/integration`; source release gate in `docs/release-verification.md`.
- Actual imports, PDF text/copy/search, annotations/exports, citations/previews, language requests, glossary/review, chat/source flashes, debugging, split view, shortcuts and responsive dialogs: `tests/e2e/acceptance.spec.ts`, `edge-flows.spec.ts`, `source-and-scope.spec.ts`, `extended.spec.ts`.
- Exact glyph/highlight intersection is checked after zoom and rotation. Citation groups/ranges, author-year, geometric superscripts, unresolved state and equation numbers in separate PDF spans have regression coverage.
- Real-paper retrieval: five controlled ablations plus a separate complete production-stage run, fixed expected passages/answers, negative refusals, per-claim source checks, scores and source hashes in `artifacts/rag-evaluation.json`.
- Operations: `docs/operations.md`, repeatable source/browser verification, manual-only CI, private ZIP-integrity-checked export including PDF storage, and `docs/demo-guide.md`. CI execution and restore were not performed.
- Every keyboard registry entry has a unique validated binding. Overrides persist, reject conflicts and preserve text entry. Escape itself can be remapped; physical Escape remains a permanent accessible dismissal fallback.

Unchecked P2 rows are known exclusions, not hidden release failures. Reference and layout detection are heuristic; unsupported scans fail explicitly. Visual equation/figure understanding and live-model language quality are not established by text/caption retrieval or protocol tests.
