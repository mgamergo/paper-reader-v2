# Paper reader v2

A research reader for people reading papers in a second language. Contextual explanations use the surrounding passage and paper evidence. English stays visible beside native-language explanations. Terms become a personal glossary and flashcards.

The complete local reader and advanced retrieval pipeline are implemented. `FEATURES.md` records pass/fail by feature and shortcut. Production authentication and generated multilingual quality require your keys and a separate live-provider acceptance run.

## Run locally

Use Bun 1.4.4, Node 22.23 or newer, and Linux/macOS. No paid model key is required for the deterministic offline provider.

```sh
bun install --frozen-lockfile
bun run local
```

The local script starts anonymous local Convex on ports 3210/3211 and Next.js on loopback port 3000. Stop it with Ctrl+C. It checks for existing servers before starting. Dependencies and PDF worker files are reproducible. Local Convex data is stored in `.convex/`, not Git.

The installed Convex 1.49 CLI rejects the former `bunx convex dev --local` command as deprecated. Its supported equivalent is `CONVEX_AGENT_MODE=anonymous bunx convex dev`. This remains an actual local backend with file storage and vector search.

To use existing local services, run the app with `APP_MODE=local bun run dev`. Tests that use storage require the local Convex backend. Tests must load its generated URLs explicitly because Bun test does not load `.env.local` automatically.

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:e2e
bun run eval:rag
```

## Configure providers and authentication

Copy optional variables from `.env.example` into untracked `.env.local`, or inject them with the Infisical CLI. The template login was verified, but no Infisical project belongs to this new app. Do not reuse unrelated project secrets.

Local mode is explicit, restricted to loopback, and uses one development workspace. For hosted use, remove `APP_MODE=local`, configure Clerk, and set Convex `ALLOW_LOCAL_AUTH=false`. Set `CLERK_JWT_ISSUER_DOMAIN` in Convex and create the Clerk JWT template named `convex`. The real Clerk flow requires your Clerk keys and cannot be verified without them. Do not deploy the local-mode configuration.

Required for real generation: an OpenAI-compatible/OpenRouter API key and model. Embeddings may use a separate endpoint/key/model. The optional Unpaywall contact email enables more open-access sources; Crossref and arXiv work without keys. No secrets are committed or sent to client components.

## Verification evidence

Initial ingestion checks cover real PDF text and coordinates, numeric/author-year references, public URL boundaries, authentication fallback, storage bytes, duplicate imports, reading state, annotations, glossary, collection cleanup, and chat history. See [release verification](docs/release-verification.md) for the tested SHA, box ID, full checks, browser diagnostics, screenshots and independent review ledger.

See `docs/architecture.md`, `FEATURES.md`, and `logbook.md` for current scope and decisions.

## Retrieval evaluation

<!-- rag-eval:start -->

| Ablation                     | Recall@5 | MRR@5 | nDCG@5 | Extractive faithfulness | Expected-answer match | Negative refusal |
| ---------------------------- | -------: | ----: | -----: | ----------------------: | --------------------: | ---------------: |
| BM25-only                    |    91.7% | 0.808 |  0.835 |                  100.0% |                 91.7% |           100.0% |
| Dense-only (hash mock)       |    66.7% | 0.542 |  0.574 |                  100.0% |                 66.7% |           100.0% |
| Hybrid                       |    83.3% | 0.642 |  0.690 |                  100.0% |                 83.3% |           100.0% |
| Hybrid + contextual          |   100.0% | 0.806 |  0.855 |                  100.0% |                100.0% |           100.0% |
| Hybrid + contextual + rerank |   100.0% | 0.958 |  0.969 |                  100.0% |                100.0% |           100.0% |

<!-- rag-eval:end -->

This deterministic offline regression uses two real CC BY 4.0 arXiv papers, OLMo and The Pile, with 93 chunks from their first six pages. Eight development questions select BM25 k1/b; twelve different positive questions and four negatives form the regression set. The selected defaults are k1=1.2, b=0.75 because the development grid tied. TF-IDF cosine and RRF are separate stages. Query rewrite, multi-query, HyDE, and parent expansion are disabled equally in this ablation to isolate the listed components; the same fixed judgments also gate a separate production-stage run with all four enabled.

The full configuration must pass every fixed expected-passage and expected-answer judgment, refuse all negatives, and preserve exact source support. The eval saves failure evidence and exits nonzero if that release gate fails. Sentence-boundary regressions cover spaced decimals, author abbreviations, line hyphenation, and naming clauses that also explain behavior. Judgments were not changed to accommodate failures.

These metrics describe an extractive token-hash mock. They do not establish learned semantic retrieval, multilingual quality, or real-model entailment. Exact extraction makes quote faithfulness easier than generated-answer faithfulness. The corpus is small, shares papers across development and test, and was reused during bug fixing. See [the protocol and limits](docs/rag-evaluation.md) and [per-question results with file hashes](artifacts/rag-evaluation.json).

## Configure a compatible model

Set `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY`. OpenAI and OpenRouter HTTPS hosts are supported by default. Other HTTPS APIs require an explicit server-side `LLM_TRUSTED_HOSTS` comma-separated allowlist. Requests cannot change hosts or models. A different embedding provider requires its own `EMBEDDING_API_KEY`; keys are not silently forwarded between provider origins.

Set `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` when embeddings use another API. The local Convex index uses 256 dimensions. Choose a model supporting that dimension. `EMBEDDING_SEND_DIMENSIONS=false` supports APIs whose fixed model dimension is already 256 and reject the dimensions parameter. Changing dimensions requires migrating the vector schema and rebuilding indexes, never padding or truncating stored vectors.

`LLM_PROMPT_CACHE=anthropic` enables explicit supported OpenRouter Anthropic cache markers. Contextualization uses a stable original-paper prefix followed by changing chunk data. Short papers may not meet model thresholds. No cache hit rate or cost saving is claimed.

The available Infisical login has no project for this app. After creating or authorizing a project, inject its selected development environment and folder into the app process:

```sh
infisical secrets-manager run --domain=https://secrets.buildwithkuro.tech \
  --projectId="$INFISICAL_PROJECT_ID" --env="$INFISICAL_ENV" \
  --path="$INFISICAL_SECRET_PATH" -- bun run dev
```

Do not print the injected environment. Production Clerk requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and the Convex `CLERK_JWT_ISSUER_DOMAIN`. Optional `UNPAYWALL_EMAIL` enables more open-access PDF resolution. Crossref and arXiv need no API key.

## Prepare offline import and layout fixtures

```sh
bun scripts/cache-import-fixtures.ts
```

This downloads and checksum-checks real public metadata and PDF bytes once into ignored `.data/import-fixtures`. The real-PDF layout regression uses this cache. Unit tests, the checked-in CC BY retrieval corpus, and the configured mock never require a paid key. For offline browser imports, start the local app with `IMPORT_FIXTURE_CACHE_DIR` pointing at that prepared cache. A missing source fails explicitly; it never becomes a synthetic paper.

## Operations and demos

See [local verification and private backup](docs/operations.md) and the [feature demo guide](docs/demo-guide.md). GitHub verification is manual-only; no CI job, deployment, publication or social post was triggered in this session. The GitHub repository remains private on branch `dev`.

## Known limits

The offline provider extracts English source text and literal definitions. It does not translate or simplify prose, and its hash vectors are not semantic embeddings. Configure a real compatible provider for those features. Hindi, Telugu and Marathi preference/action wiring, paired native citations and source-linked vocabulary are tested as protocols; generated quality is unmeasured. Real Clerk authentication requires external keys and has not been exercised; local ownership rules have real-backend tests with two identities.

PDF layouts, bibliography variants and formula extraction use bounded heuristics. Figure/equation assistance uses actual text, captions and section evidence; it does not claim image or mathematical understanding. Scans without text are rejected; OCR, large-library worker queues, collaborative editing, TTS and reference-manager sync remain P2. Chromium desktop/tablet/mobile viewports were checked; Firefox, Safari and physical devices were not. The backup includes stored PDFs and passes ZIP integrity; restore is untested.
