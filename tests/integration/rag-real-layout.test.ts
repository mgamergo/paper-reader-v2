import { expect, test } from "bun:test";
import { readImportFixture } from "../../lib/server/import-cache";
import { parsePdf } from "../../lib/server/pdf";
import { paperSchema } from "../../lib/domain";
import { buildIndex, answerQuestion } from "../../lib/rag";
import { assistRequestSchema } from "../../lib/domain";

test("real Attention PDF retains nested sections, bibliography continuation, and post-bibliography figures", async () => {
  // Shared public fixture is fetched by the parent's documented cache-import-fixtures setup.
  const source = await readImportFixture(
    ".data/import-fixtures",
    "https://arxiv.org/pdf/1706.03762",
    25 * 1024 * 1024,
  );
  const parsed = await parsePdf(source.bytes, "attention.pdf");
  const paper = paperSchema.parse({
    ...parsed,
    id: "real-attention-layout",
    sourceUrl: "https://arxiv.org/abs/1706.03762v7",
    arxivId: "1706.03762v7",
    pdfUrl: source.url,
    tags: [],
    collectionIds: [],
    progress: 0,
    currentPage: 1,
    createdAt: 0,
    status: "ready",
  });
  expect(paper.pages.length).toBe(15);
  expect(
    paper.outline.some((o) => o.title === "References" && o.depth === 0),
  ).toBe(true);
  const index = await buildIndex([paper]);
  const attention = index.chunks.find(
    (c) => c.page === 4 && c.text.includes("We compute the dot products"),
  );
  expect(attention?.sectionPath.length).toBe(3);
  expect(attention?.sectionPath[0]).toContain("Model Architecture");
  expect(attention?.sectionPath[1]).toContain("Attention");
  expect(attention?.sectionPath[2]).toContain("Scaled Dot-Product Attention");
  for (const page of [11, 12]) {
    const chunks = index.chunks.filter((c) => c.page === page);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.kind === "references")).toBe(true);
  }
  for (const page of [13, 14, 15])
    expect(
      index.chunks
        .filter((c) => c.page === page)
        .every((c) => c.kind !== "references"),
    ).toBe(true);
  const answer = await answerQuestion({
    papers: [paper],
    index,
    request: assistRequestSchema.parse({
      query: "How does scaled dot-product attention work?",
    }),
  });
  expect(answer.refused).toBe(false);
  expect(answer.sentences.some((s) => s.text.includes("We call"))).toBe(false);
  expect(
    answer.sentences.some(
      (s) => s.text.includes("softmax") && s.text.includes("divide"),
    ),
  ).toBe(true);
  expect(
    answer.sentences.every((s) => s.citations.every((c) => c.rects.length > 0)),
  ).toBe(true);
});
