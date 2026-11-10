import { expect, test } from "bun:test";
import { ConvexHttpClient } from "convex/browser";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { api } from "../../convex/_generated/api";
import { makeReaderFixture } from "../../scripts/make-reader-fixture";
import { importPaper } from "../../lib/server/import";
import {
  librarySchema,
  paperSchema,
  type Annotation,
  type GlossaryEntry,
  type ChatMessage,
} from "../../lib/domain";
test("Convex stores PDF bytes and owner-scoped reading, annotations, glossary, collections, history", async () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url)
    throw new Error("Start the local Convex backend before integration tests.");
  const client = new ConvexHttpClient(url);
  const pdf = await PDFDocument.load(await makeReaderFixture());
  pdf.setProducer(`integration-${randomUUID()}`);
  const bytes = await pdf.save();
  let paperId: string | undefined;
  let collectionId: string | undefined;
  try {
    const paper = await importPaper({
      client,
      token: null,
      file: new File([new Uint8Array(bytes)], "fixture.pdf", {
        type: "application/pdf",
      }),
    });
    paperId = paper.id;
    const duplicate = await importPaper({
      client,
      token: null,
      file: new File([new Uint8Array(bytes)], "again.pdf", {
        type: "application/pdf",
      }),
    });
    expect(duplicate.id).toBe(paper.id);
    const storageUrl = await client.query(api.workspace.pdfUrl, { paperId });
    expect(storageUrl).toBeTruthy();
    if (!storageUrl) throw new Error("Missing file storage URL");
    const stored = await fetch(storageUrl);
    expect(stored.ok).toBe(true);
    expect(new Uint8Array(await stored.arrayBuffer())).toEqual(
      new Uint8Array(bytes),
    );
    const collection = await client.mutation(api.workspace.putCollection, {
      json: JSON.stringify({
        id: randomUUID(),
        name: "Integration research",
        color: "#3158a0",
      }),
    });
    collectionId = collection.id;
    await client.mutation(api.workspace.patchPaper, {
      paperId,
      json: JSON.stringify({
        currentPage: 2,
        progress: 0.5,
        collectionIds: [collection.id],
        tags: ["verified"],
      }),
    });
    const saved = paperSchema.parse(
      await client.query(api.workspace.getPaper, { paperId }),
    );
    expect(saved.currentPage).toBe(2);
    expect(saved.collectionIds).toEqual([collection.id]);
    const annotation: Annotation = {
      id: randomUUID(),
      paperId,
      page: 1,
      kind: "highlight",
      text: "attention assigns different weights",
      comment: "Verified persisted note",
      color: "yellow",
      rects: [{ x: 50, y: 200, width: 200, height: 12 }],
      tags: ["term"],
      createdAt: Date.now(),
    };
    await expect(
      client.mutation(api.workspace.putAnnotation, {
        json: JSON.stringify({ ...annotation, page: 999 }),
      }),
    ).rejects.toThrow("Annotation page does not exist");
    await expect(
      client.mutation(api.workspace.putAnnotation, {
        json: JSON.stringify({
          ...annotation,
          rects: [{ x: -100, y: 0, width: 20, height: 10 }],
        }),
      }),
    ).rejects.toThrow("outside the page");
    await client.mutation(api.workspace.putAnnotation, {
      json: JSON.stringify(annotation),
    });
    expect(await client.query(api.workspace.annotations, { paperId })).toEqual([
      annotation,
    ]);
    const word: GlossaryEntry = {
      id: randomUUID(),
      paperId,
      term: "attention",
      definition: "A weighting mechanism",
      translation: "",
      language: "English",
      context: "In machine learning, attention assigns different weights.",
      dueAt: Date.now(),
      interval: 0,
      repetitions: 0,
      createdAt: Date.now(),
    };
    await client.mutation(api.workspace.putGlossary, {
      json: JSON.stringify(word),
    });
    await client.mutation(api.workspace.patchGlossary, {
      id: word.id,
      json: JSON.stringify({
        repetitions: 1,
        interval: 1,
        dueAt: Date.now() + 86400000,
      }),
    });
    const message: ChatMessage = {
      id: randomUUID(),
      paperId,
      role: "user",
      text: "What is attention?",
      createdAt: Date.now(),
    };
    await client.mutation(api.workspace.addMessages, {
      json: JSON.stringify([message]),
    });
    expect(await client.query(api.workspace.chat, { paperId })).toEqual([
      message,
    ]);
    const library = librarySchema.parse(
      await client.query(api.workspace.library, {}),
    );
    expect(
      library.glossary.find((entry) => entry.id === word.id)?.repetitions,
    ).toBe(1);
    const collectionMessage = {
      ...message,
      id: randomUUID(),
      paperId: `collection:${collection.id}`,
    };
    await client.mutation(api.workspace.addMessages, {
      json: JSON.stringify([collectionMessage]),
    });
    await client.mutation(api.workspace.deleteCollection, {
      id: collection.id,
    });
    // Reusing the same collection ID exposes any physically orphaned history.
    await client.mutation(api.workspace.putCollection, {
      json: JSON.stringify(collection),
    });
    expect(
      await client.query(api.workspace.chat, {
        paperId: `collection:${collection.id}`,
      }),
    ).toEqual([]);
    await client.mutation(api.workspace.deleteCollection, {
      id: collection.id,
    });

    collectionId = undefined;
    expect(
      paperSchema.parse(await client.query(api.workspace.getPaper, { paperId }))
        .collectionIds,
    ).toEqual([]);
    await client.mutation(api.workspace.deleteAnnotation, {
      id: annotation.id,
    });
    expect(await client.query(api.workspace.annotations, { paperId })).toEqual(
      [],
    );
  } finally {
    if (paperId) await client.mutation(api.workspace.deletePaper, { paperId });
    if (collectionId)
      await client.mutation(api.workspace.deleteCollection, {
        id: collectionId,
      });
  }
}, 60000);
