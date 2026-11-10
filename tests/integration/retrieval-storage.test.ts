import { expect, test } from "bun:test";
import { ConvexHttpClient } from "convex/browser";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { api } from "../../convex/_generated/api";
import { makeReaderFixture } from "../../scripts/make-reader-fixture";
import { importPaper } from "../../lib/server/import";
import {
  askLibrary,
  persistedIndex,
  configuredProvider,
} from "../../lib/server/rag";
import { MockProvider, answerQuestion } from "../../lib/rag";
import { assistRequestSchema, paperSchema } from "../../lib/domain";
test("persisted contextual chunks feed real Convex vector search and grounded answers", async () => {
  const client = new ConvexHttpClient(
    process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210",
  );
  const pdf = await PDFDocument.load(await makeReaderFixture());
  pdf.setProducer(`retrieval-integration-${randomUUID()}`);
  const bytes = await pdf.save();
  let paperId: string | undefined;
  try {
    const paper = await importPaper({
      client,
      token: null,
      file: new File([new Uint8Array(bytes)], "retrieval.pdf", {
        type: "application/pdf",
      }),
    });
    paperId = paper.id;
    const provider = configuredProvider();
    const first = await persistedIndex(client, [paper], provider);
    const second = await persistedIndex(client, [paper], provider);
    expect(second).toEqual(first);
    expect(first.chunks.length).toBeGreaterThan(1);
    const rows = await client.query(api.workspace.chunks, { paperId });
    expect(rows.length).toBe(first.chunks.length);
    expect(
      rows.every((row) =>
        row.chunk.contextualText.includes("Contextual Reading and Attention"),
      ),
    ).toBe(true);
    const target = first.chunks.at(-1);
    const vector = (await provider.embed(["attention"]))[0];
    const version = rows[0]?.version;
    if (!target || !vector || !version)
      throw new Error("Fixture index is missing required chunks or vectors");
    const filtered = await client.action(api.search.dense, {
      vector,
      paperIds: [paperId],
      version,
      allowedChunkIds: [target.id],
    });
    expect(filtered.map((hit) => hit.chunkId)).toEqual([target.id]);
    const answer = await askLibrary({
      client,
      papers: [paper],
      request: assistRequestSchema.parse({
        paperId,
        query: "What does attention do in machine learning?",
        language: "English",
      }),
    });
    expect(answer.refused).toBe(false);
    expect(answer.debug.stages).toContain("external-vector-search");
    expect(answer.debug.stages).toContain("rrf");
    expect(
      answer.debug.stages.some((stage) => stage.startsWith("tfidf:")),
    ).toBe(true);
    expect(
      answer.debug.hits.some((hit) =>
        Object.keys(hit.ranks).some((stage) => stage.startsWith("dense:")),
      ),
    ).toBe(true);
    expect(answer.sentences.length).toBeGreaterThan(0);
    for (const sentence of answer.sentences) {
      expect(sentence.citations.length).toBeGreaterThan(0);
      for (const citation of sentence.citations) {
        expect(citation.paperId).toBe(paper.id);
        expect(
          paper.pages
            .find((page) => page.number === citation.page)
            ?.text.replace(/\s+/g, " "),
        ).toContain(citation.quote.replace(/\s+/g, " "));
        expect(citation.rects.length).toBeGreaterThan(0);
      }
    }
    const unsupported = await askLibrary({
      client,
      papers: [paper],
      request: assistRequestSchema.parse({
        paperId,
        query: "What is the predicted stock price of NVIDIA in 2035?",
      }),
    });
    expect(unsupported.refused).toBe(true);
  } finally {
    if (paperId) await client.mutation(api.workspace.deletePaper, { paperId });
  }
}, 60000);

test("resolved citation metadata reuses stored embeddings while source title changes rebuild", async () => {
  const client = new ConvexHttpClient(
    process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210",
  );
  class Counted extends MockProvider {
    contexts = 0;
    override async contextualize(
      input: Parameters<MockProvider["contextualize"]>[0],
    ) {
      this.contexts++;
      return super.contextualize(input);
    }
  }
  const provider = new Counted();
  const pdf = await PDFDocument.load(await makeReaderFixture());
  pdf.setProducer(`cache-integration-${randomUUID()}`);
  let paperId: string | undefined;
  try {
    const paper = await importPaper({
      client,
      token: null,
      file: new File([new Uint8Array(await pdf.save())], "cache.pdf", {
        type: "application/pdf",
      }),
    });
    paperId = paper.id;
    const initial = await persistedIndex(client, [paper], provider);
    const calls = provider.contexts;
    expect(calls).toBe(initial.chunks.length);
    await client.mutation(api.workspace.patchPaper, {
      paperId,
      json: JSON.stringify({
        references: paper.references.map((reference) => ({
          ...reference,
          abstract:
            "Resolved bibliographic metadata for the authored cache regression.",
        })),
      }),
    });
    const resolved = paperSchema.parse(
      await client.query(api.workspace.getPaper, { paperId }),
    );
    const cached = await persistedIndex(client, [resolved], provider);
    expect(provider.contexts).toBe(calls);
    expect(cached).toEqual(initial);
    const answer = await answerQuestion({
      papers: [resolved],
      index: cached,
      provider,
      request: assistRequestSchema.parse({
        paperId,
        query: "What does attention do in machine learning?",
      }),
    });
    expect(answer.refused).toBe(false);
    await client.mutation(api.workspace.patchPaper, {
      paperId,
      json: JSON.stringify({ title: "Corrected source title" }),
    });
    const retitled = paperSchema.parse(
      await client.query(api.workspace.getPaper, { paperId }),
    );
    await persistedIndex(client, [retitled], provider);
    expect(provider.contexts).toBeGreaterThan(calls);
  } finally {
    if (paperId) await client.mutation(api.workspace.deletePaper, { paperId });
  }
}, 60000);
