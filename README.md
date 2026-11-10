# Paper reader v2

A research reader for people reading papers in a second language. Contextual explanations use the surrounding passage and paper evidence. English stays visible beside native-language explanations. Terms become a personal glossary and flashcards.

Development is in progress. `FEATURES.md` is the release checklist; unchecked features are not verified.

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

Required for real generation: an OpenAI-compatible/OpenRouter API key and model. Embeddings may use a separate endpoint/key/model. Optional metadata credentials are Semantic Scholar API key and Unpaywall contact email; Crossref and arXiv work without keys. No secrets are committed or sent to client components.

## Verification evidence

Initial ingestion checks cover real PDF text and coordinates, numeric/author-year references, public URL boundaries, authentication fallback, storage bytes, duplicate imports, reading state, annotations, glossary, collection cleanup, and chat history. Full product and retrieval evaluation evidence will be recorded here after integration.

See `docs/architecture.md`, `FEATURES.md`, and `logbook.md` for current scope and decisions.
