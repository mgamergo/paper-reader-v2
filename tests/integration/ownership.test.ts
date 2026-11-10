import { expect, test } from "bun:test";
import { ConvexHttpClient } from "convex/browser";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { api } from "../../convex/_generated/api";
import { makeReaderFixture } from "../../scripts/make-reader-fixture";
import { parsePdf } from "../../lib/server/pdf";
import {
  paperSchema,
  annotationSchema,
  glossarySchema,
} from "../../lib/domain";
test("real Convex functions isolate two authenticated identities across PDF, notes, glossary, chat, and chunks", async () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error(
      "Ownership integration impersonation is restricted to local Convex.",
    );
  const { adminKey } = z
    .object({ adminKey: z.string() })
    .parse(
      JSON.parse(await readFile(".convex/local/default/config.json", "utf8")),
    );
  const suffix = randomUUID();
  const aliceIdentity = {
    subject: `alice-${suffix}`,
    issuer: "https://reader.test",
    tokenIdentifier: `https://reader.test|alice-${suffix}`,
  };
  const bobIdentity = {
    subject: `bob-${suffix}`,
    issuer: "https://reader.test",
    tokenIdentifier: `https://reader.test|bob-${suffix}`,
  };
  const alice = new ConvexHttpClient(url);
  const aliceSetter: unknown = Reflect.get(alice, "setAdminAuth");
  if (typeof aliceSetter !== "function")
    throw new Error(
      "The pinned Convex test SDK does not support local identity impersonation",
    );
  Reflect.apply(aliceSetter, alice, [adminKey, aliceIdentity]);
  const bob = new ConvexHttpClient(url);
  const bobSetter: unknown = Reflect.get(bob, "setAdminAuth");
  if (typeof bobSetter !== "function")
    throw new Error(
      "The pinned Convex test SDK does not support local identity impersonation",
    );
  Reflect.apply(bobSetter, bob, [adminKey, bobIdentity]);
  const bytes = await makeReaderFixture();
  const parsed = await parsePdf(bytes, "ownership.pdf");
  const paperId = randomUUID();
  let stored = false;
  try {
    const site =
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://127.0.0.1:3211";
    if (!["localhost", "127.0.0.1"].includes(new URL(site).hostname))
      throw new Error("Local storage URL required.");
    const response = await fetch(`${site}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        Authorization: `Convex ${adminKey}:${Buffer.from(JSON.stringify(aliceIdentity)).toString("base64")}`,
      },
      body: new Uint8Array(bytes),
    });
    expect(response.ok).toBe(true);
    const { storageId } = z
      .object({ storageId: z.string() })
      .parse(await response.json());
    const paper = paperSchema.parse({
      ...parsed,
      id: paperId,
      pdfUrl: `/api/papers/${paperId}/pdf`,
      storageId,
      tags: [],
      collectionIds: [],
      progress: 0,
      currentPage: 1,
      createdAt: Date.now(),
      status: "ready",
    });
    await alice.mutation(api.workspace.addPaper, {
      json: JSON.stringify(paper),
      storageId,
      fingerprint: createHash("sha256").update(bytes).digest("hex"),
    });
    stored = true;
    const annotation = annotationSchema.parse({
      id: randomUUID(),
      paperId,
      page: 1,
      kind: "note",
      text: "Private selected passage",
      comment: "Alice private note",
      color: "blue",
      rects: [],
      tags: [],
      createdAt: Date.now(),
    });
    await alice.mutation(api.workspace.putAnnotation, {
      json: JSON.stringify(annotation),
    });
    const word = glossarySchema.parse({
      id: randomUUID(),
      paperId,
      term: "attention",
      definition: "Alice contextual definition",
      translation: "",
      language: "English",
      context: "An attention mechanism",
      dueAt: Date.now(),
      interval: 0,
      repetitions: 0,
      createdAt: Date.now(),
    });
    await alice.mutation(api.workspace.putGlossary, {
      json: JSON.stringify(word),
    });
    expect((await bob.query(api.workspace.library, {})).papers).toHaveLength(0);
    await expect(
      bob.query(api.workspace.getPaper, { paperId }),
    ).rejects.toThrow("Paper not found");
    await expect(bob.query(api.workspace.pdfUrl, { paperId })).rejects.toThrow(
      "Paper not found",
    );
    await expect(
      bob.query(api.workspace.annotations, { paperId }),
    ).rejects.toThrow("Paper not found");
    await expect(
      bob.mutation(api.workspace.patchPaper, {
        paperId,
        json: JSON.stringify({ title: "Stolen paper" }),
      }),
    ).rejects.toThrow("Paper not found");
    await bob.mutation(api.workspace.deleteAnnotation, { id: annotation.id });
    expect(await alice.query(api.workspace.annotations, { paperId })).toEqual([
      annotation,
    ]);
    await expect(
      bob.mutation(api.workspace.patchGlossary, {
        id: word.id,
        json: JSON.stringify({ definition: "Stolen" }),
      }),
    ).rejects.toThrow("Glossary term not found");
    await expect(bob.query(api.workspace.chat, { paperId })).rejects.toThrow(
      "Paper not found",
    );
    await expect(bob.query(api.workspace.chunks, { paperId })).rejects.toThrow(
      "Paper not found",
    );
    await expect(
      bob.mutation(api.workspace.replaceChunks, {
        paperId,
        json: "[]",
        version: "forged",
      }),
    ).rejects.toThrow("Paper not found");
    await expect(
      bob.mutation(api.workspace.addPaper, {
        json: JSON.stringify({ ...paper, id: randomUUID() }),
        storageId,
        fingerprint: "forged",
      }),
    ).rejects.toThrow("Upload does not belong");
    await expect(
      bob.mutation(api.workspace.deletePaper, { paperId }),
    ).rejects.toThrow("Paper not found");
    expect((await alice.query(api.workspace.getPaper, { paperId })).title).toBe(
      paper.title,
    );
  } finally {
    if (stored) await alice.mutation(api.workspace.deletePaper, { paperId });
  }
}, 60000);
