import { createHash } from "node:crypto";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import {
  type Paper,
  type AssistRequest,
  type RagAnswer,
  chunkSchema,
} from "../domain";
import {
  buildIndex,
  answerQuestion,
  MockProvider,
  OpenAICompatibleProvider,
  indexSchema,
  sameIdentity,
  RagError,
  type RagProvider,
  type RagIndex,
  type VectorSearch,
} from "../rag";
const dimensions = 256;
export function configuredProvider(): RagProvider {
  if (!process.env.LLM_PROVIDER || process.env.LLM_PROVIDER === "mock")
    return new MockProvider();
  if (
    !["openai-compatible", "openrouter", "openai"].includes(
      process.env.LLM_PROVIDER,
    )
  )
    throw new RagError(
      "configuration",
      "LLM_PROVIDER must be mock or openai-compatible.",
    );
  const baseUrl =
    process.env.LLM_BASE_URL ??
    (process.env.LLM_PROVIDER === "openai"
      ? "https://api.openai.com/v1"
      : "https://openrouter.ai/api/v1");
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new RagError(
      "configuration",
      "LLM_BASE_URL must be a valid HTTPS API URL.",
    );
  }
  const apiKey =
    process.env.LLM_API_KEY ??
    (host === "api.openai.com"
      ? process.env.OPENAI_API_KEY
      : host === "openrouter.ai"
        ? process.env.OPENROUTER_API_KEY
        : undefined);
  const chatModel = process.env.LLM_MODEL;
  const embeddingModel =
    process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
  if (!apiKey || !chatModel)
    throw new RagError(
      "configuration",
      "Set LLM_API_KEY and LLM_MODEL for contextual explanations.",
    );
  const embeddingUrl = process.env.EMBEDDING_BASE_URL ?? baseUrl;
  if (
    new URL(embeddingUrl).origin !== new URL(baseUrl).origin &&
    !process.env.EMBEDDING_API_KEY
  )
    throw new RagError(
      "configuration",
      "A separate EMBEDDING_API_KEY is required for a different embedding provider.",
    );
  const trustedHosts = (process.env.LLM_TRUSTED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  const sendDimensions = process.env.EMBEDDING_SEND_DIMENSIONS !== "false";
  const chat = new OpenAICompatibleProvider({
    trustedHosts,
    sendDimensions,
    apiKey,
    baseUrl,
    chatModel,
    embeddingModel,
    dimensions,
    cache:
      process.env.LLM_PROMPT_CACHE === "anthropic"
        ? "openrouter-anthropic"
        : "automatic",
  });
  if (!process.env.EMBEDDING_BASE_URL && !process.env.EMBEDDING_API_KEY)
    return chat;
  const embedding = new OpenAICompatibleProvider({
    trustedHosts,
    sendDimensions,
    apiKey: process.env.EMBEDDING_API_KEY ?? apiKey,
    baseUrl: process.env.EMBEDDING_BASE_URL ?? baseUrl,
    chatModel,
    embeddingModel,
    dimensions,
  });
  return {
    name: chat.name,
    identity: embedding.identity,
    contextIdentity: chat.contextIdentity,
    limitations: chat.limitations,
    contextualize: (input) => chat.contextualize(input),
    expand: (query) => chat.expand(query),
    embed: (texts) => embedding.embed(texts),
    rerank: (input) => chat.rerank(input),
    answer: (input) => chat.answer(input),
    verify: (input) => chat.verify(input),
  };
}
function fingerprint(paper: Paper): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: paper.id,
        title: paper.title,
        pages: paper.pages,
        outline: paper.outline,
        references: paper.references,
      }),
    )
    .digest("hex");
}
function versionFor(provider: RagProvider): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        provider.identity,
        provider.contextIdentity,
        "convex-vector-scope-v2-layout-body-v2",
      ]),
    )
    .digest("hex");
}
export async function persistedIndex(
  client: ConvexHttpClient,
  papers: Paper[],
  provider: RagProvider,
): Promise<RagIndex> {
  const version = versionFor(provider);
  const indexes: RagIndex[] = [];
  for (const paper of papers) {
    const manifest = await client.query(api.workspace.indexManifest, {
      paperId: paper.id,
    });
    let index: RagIndex | undefined;
    if (manifest?.version === version) {
      try {
        const metadata = indexSchema
          .omit({ chunks: true })
          .parse(JSON.parse(manifest.json));
        if (
          metadata.fingerprints[paper.id] === fingerprint(paper) &&
          sameIdentity(metadata.embedding, provider.identity) &&
          metadata.contextIdentity === provider.contextIdentity
        ) {
          const stored = await client.query(api.workspace.chunks, {
            paperId: paper.id,
          });
          if (stored.every((row) => row.version === version)) {
            const chunks = stored.map((row) => chunkSchema.parse(row.chunk));
            index = indexSchema.parse({ ...metadata, chunks });
          }
        }
      } catch {
        index = undefined;
      }
    }
    if (!index) {
      index = await buildIndex([paper], { provider });
      if (index.embedding.dimensions !== dimensions)
        throw new RagError(
          "configuration",
          `Convex vector index expects ${dimensions} dimensions.`,
        );
      await client.mutation(api.workspace.replaceChunks, {
        paperId: paper.id,
        json: JSON.stringify(index.chunks),
        version,
      });
      const metadata = indexSchema.omit({ chunks: true }).parse(index);
      await client.mutation(api.workspace.saveManifest, {
        paperId: paper.id,
        json: JSON.stringify(metadata),
        version,
      });
    }
    indexes.push(index);
  }
  const first = indexes[0];
  if (!first)
    throw new RagError("validation", "Choose a paper with readable text.");
  return indexSchema.parse({
    ...first,
    fingerprints: Object.assign(
      {},
      ...indexes.map((index) => index.fingerprints),
    ),
    chunks: indexes.flatMap((index) => index.chunks),
  });
}
export async function askLibrary({
  client,
  papers,
  request,
}: {
  client: ConvexHttpClient;
  papers: Paper[];
  request: AssistRequest;
}): Promise<RagAnswer> {
  const provider = configuredProvider();
  const roots = papers.filter(
    (paper) =>
      (!request.paperId || paper.id === request.paperId) &&
      (!request.collectionId ||
        paper.collectionIds.includes(request.collectionId)),
  );
  if (!roots.length)
    throw new RagError(
      "validation",
      "The selected paper or collection was not found.",
    );
  const allowed = new Set(roots.map((paper) => paper.id));
  if (request.filters.expandCitations)
    for (const paper of roots)
      for (const reference of paper.references)
        if (
          reference.ingestedPaperId &&
          papers.some((paper) => paper.id === reference.ingestedPaperId)
        )
          allowed.add(reference.ingestedPaperId);
  const scoped = papers.filter((paper) => allowed.has(paper.id));
  const index = await persistedIndex(client, scoped, provider);
  const version = versionFor(provider);
  const vectorSearch: VectorSearch = async (input) => {
    const hits = await client.action(api.search.dense, {
      vector: input.vector,
      paperIds: scoped.map((paper) => paper.id),
      version,
      ...(request.filters.kind || request.filters.section
        ? { allowedChunkIds: input.allowedChunkIds }
        : {}),
    });
    const allowedChunks = new Set(input.allowedChunkIds);
    return {
      identity: provider.identity,
      hits: hits
        .filter((hit) => allowedChunks.has(hit.chunkId) && hit.score > 0)
        .map((hit) => ({ id: hit.chunkId, score: hit.score })),
    };
  };
  return answerQuestion({
    papers: scoped,
    request,
    index,
    provider,
    vectorSearch,
  });
}
