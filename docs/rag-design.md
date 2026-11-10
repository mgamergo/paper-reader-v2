# RAG design

This subsystem helps non-native English readers trace every answer sentence to an ingested paper. It accepts the existing `Paper` and `AssistRequest` contracts and returns the existing `RagAnswer` contract.

## Alternatives

1. A single orchestrator with injected functions for each stage. This is quick to wire, but ranking mathematics, provider validation, and citation policy become interleaved and difficult to test independently.
2. Small modules organized around owned data: layout chunks, rankers, provider messages, a persisted index, and grounded answers. The orchestrator composes these without a plugin registry or framework.

Choose option 2. `chunks.ts` owns reading order and anchors; `ranking.ts` owns numeric retrieval; `provider.ts` and `mock.ts` own remote and offline behavior; `index.ts` owns index identity, retrieval, and answer assembly; `contracts.ts` owns only internal/provider/persistence contracts. Public document shapes remain in `lib/domain.ts`.

## Data and trust

An index is versioned chunks plus embedding identity, contextualization identity, parameters, and SHA-256 fingerprints of input papers. Context prefixes enrich lexical and vector inputs but never become citation evidence. Parent expansion adds actual sibling chunks with their own anchors. Selection text and generated HyDE text are retrieval hints, never evidence. Only exact substrings of supplied chunk text can become quotations. A second support check must accept generated claims; an empty or invalid result refuses. A model can still make semantic support errors; syntactic quote verification is not a formal proof of entailment.

Providers expose contextualization, rewrite/multi-query/HyDE, embeddings, reranking, answer generation, and support checks. Calls have input/output/count/time bounds and no tools. Credentials and endpoints are server configuration, not request parameters. Explicit prompt-cache controls are sent only for supported OpenRouter Anthropic models; otherwise stable prefixes use provider automatic caching. No cache-hit or cost claim is inferred.

## Work and verification

Implement contracts and providers, then chunk/ranking/index behavior, then real-paper fixtures and held-out evaluations. One worker, sequential calls, no delegates, no package/domain/backend edits. Use Type System Discipline to parse provider and serialized data with Zod; Model the Domain keeps evidence and index identity explicit. Unit checks target mathematical and boundary failures; integration checks exercise public APIs and refusal. Parent owns browser/UI, Convex authorization and persistence, and real-provider credential provisioning.
