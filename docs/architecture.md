# Architecture

The user's reading state consists of Paper, PaperPage, Reference, Annotation, GlossaryEntry, Collection, Settings, Chunk, and ChatMessage. Zod schemas in lib/domain.ts own the public contract. Coordinates use PDF page points with a top-left origin, independent of zoom.

Two candidate structures were considered before implementation. A browser-owned local-first store with an optional remote mirror simplifies a demo but creates two ownership and search paths. The chosen structure uses Convex as the authoritative database, upload store, and vector index. Next route handlers validate inputs, fetch identity-scoped documents, run PDF ingestion or retrieval, and persist results through Convex. Reader components consume one typed HTTP contract. Offline means no paid model or metadata key, not a second database.

The RAG module accepts typed Paper inputs and an injectable provider. Layout chunks preserve page coordinates, section ancestry, and parent text. Before indexing, a provider generates chunk context from the paper and section. BM25, TF-IDF cosine, and dense similarity produce independent rankings. RRF fuses ranks. Rewritten/multiple queries and HyDE expand the query. Reranking scores candidate relevance against parent context. Filters apply before ranking; citation expansion includes only owned, ingested cited works. Every answer sentence names a verified passage or the answer refuses. Debug data records stage scores and ranks.

Production identity uses Clerk and Convex JWT verification. The explicit local development mode is loopback-only and uses a stable local workspace identity. No API key reaches client code. Imports accept public HTTP(S) PDF/metadata sources after network boundary validation, with size/time limits. Document text is untrusted evidence, never instructions.

Visual direction: a quiet blue-ink reading desk, blue #3158a0, navy #182b49, slate #69788c, mist #eef3f9, white #ffffff, muted gold #bc9045. System sans for tools and a serif for reading prose. The bilingual explanation pane is the distinctive element. Desktop has a narrow document rail, actual PDF, and a learning pane; mobile switches between reading and learning with accessible controls.

## Bilingual source bindings

A separate array of translated sentences with numeric pointers was considered. It allows pointers to drift when a provider splits or reorders English sentences. The chosen shape pairs each translated sentence with its English claim and uses the same validated passage citations. The answer also stores its requested language, so saved history does not relabel a Hindi explanation when preferences change to Telugu. The aggregate translation string remains for older clients and copy/export.

Glossary definitions carry their own evidence quotes. Quote IDs and text are validated against retrieved original passages before a model support check. Definitions without anchors and unpaired or conflicting translations fail closed. English-only mock responses remain explicit about unavailable translations. Sentence splitting preserves original decimals, author abbreviations and source glyphs; native text is never matched to sources by assuming positional correspondence between two independently generated arrays.
