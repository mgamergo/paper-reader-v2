# RAG verification

The implementation and all tests run in boxes.dev instance `0e09ad54-c2a4-4c19-8e9b-2d80fca789a4`, repository `/home/boxes/repos/paper-reader-v2`. Current source started from `eaf34e6` with the RAG feature still uncommitted. The evaluation report records exact source hashes and working-tree status. The final release report will name the clean tested commit.

The parent reran project strict type checking and global ESLint successfully. The complete unit/integration run passed 91 tests with 404 assertions across 18 files. Four additional provider-configuration tests passed separately. Browser acceptance is still in progress against an earlier production artifact; current RAG changes require a final rebuild and browser rerun.

The unchanged real-paper evaluation now passes its full-pipeline release gate. Recall@5 is 1.0, MRR@5 is 0.958333, nDCG@5 is 0.969244, extractive quote faithfulness is 1.0, expected-answer match is 1.0, and all four negative queries refuse. Baseline ablations remain lower and are retained. See `docs/rag-evaluation.md` and `artifacts/rag-evaluation.json` for protocol, per-question output and limitations.

Three failures found in the initial worker evaluation were fixed without changing judgments. Spaced decimals no longer split a sentence before its answer. Author abbreviations remain within sentences. Line-wrapped hyphenation is normalized only for lexical matching, preserving original evidence and quotes. A naming clause is retained when it also explains behavior. Focused tests cover these cases and private-use glyph preservation. The integration test now runs all unchanged positive and negative judgments, and the eval command exits nonzero on a full-pipeline passage, answer, refusal, or support regression.

The real 15-page Attention PDF regression checks three-level section ancestry, bibliography continuation, appendix reset and an actual procedural attention answer with source rectangles. The two tracked retrieval papers retain CC BY 4.0 source attribution and original PDF hashes. No synthetic paper replaces a failed download.

Index format 3 and offline embedding revision 3 invalidate earlier snapshots. Real compatible provider payloads, caching prefixes, response validation and deployment host configuration are tested with deterministic protocol doubles. No paid/live model request, external Clerk sign-in, real semantic retrieval quality, multilingual quality, cache savings, latency or cost was measured.

`artifacts/rag-worker-verification.json` preserves the historical worker run before the three evaluation fixes. Its former global lint and formatting findings were repaired: source lint excludes the generated pinned pdf.js worker, PostCSS uses a named config export, and shared configuration formatting is corrected. It is historical evidence, not the final release result.
