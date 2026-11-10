import { expect, test } from "bun:test";
import { parsePdf } from "../../lib/server/pdf";
import { paperSchema, assistRequestSchema } from "../../lib/domain";
import { buildIndex, answerQuestion, retrieve } from "../../lib/rag";
import { syntheticPaper } from "../unit/rag-fixtures";
async function fixture() {
  return paperSchema.parse({
    ...syntheticPaper("action-scope"),
    ...(await parsePdf(
      new Uint8Array(
        await Bun.file(
          "tests/fixtures/reader/contextual-reading.pdf",
        ).arrayBuffer(),
      ),
      "fixture.pdf",
    )),
  });
}
test("related work answers extract actual cited titles from bibliography evidence", async () => {
  const paper = await fixture();
  const index = await buildIndex([paper]);
  const answer = await answerQuestion({
    papers: [paper],
    index,
    request: assistRequestSchema.parse({
      paperId: paper.id,
      action: "related",
      query: "Find related papers",
      selection: {
        text: "attention",
        context:
          "Attention is a mechanism that weights input representations according to relevance.",
        page: 1,
      },
    }),
  });
  expect(answer.refused).toBe(false);
  expect(answer.sentences.map((s) => s.text).join(" ")).toContain(
    "Attention Is All You Need",
  );
  expect(
    answer.debug.hits.every((hit) => hit.chunk.kind === "references"),
  ).toBe(true);
  expect(answer.debug.stages).toContain("related-bibliography-scope");
  expect(
    answer.sentences.flatMap((s) => s.citations).every((c) => c.page === 2),
  ).toBe(true);
});
test("related work refuses when a paper has no bibliography evidence", async () => {
  const paper = syntheticPaper();
  const answer = await answerQuestion({
    papers: [paper],
    request: assistRequestSchema.parse({
      paperId: paper.id,
      action: "related",
      query: "Find related papers",
    }),
  });
  expect(answer.refused).toBe(true);
});
test("summarize section infers the selected chunk section and respects explicit overrides", async () => {
  const paper = await fixture();
  const index = await buildIndex([paper]);
  const selected =
    "In machine learning, attention assigns different weights to input representations.";
  const request = assistRequestSchema.parse({
    paperId: paper.id,
    action: "summarize",
    query: "Summarize this section",
    selection: { text: selected, context: selected, page: 1 },
  });
  const answer = await answerQuestion({ papers: [paper], index, request });
  expect(answer.refused).toBe(false);
  expect(answer.debug.filters.section).toBe("1 Introduction");
  expect(answer.debug.stages).toContain("selected-section-scope");
  expect(
    answer.debug.hits.every((hit) =>
      hit.chunk.sectionPath.includes("1 Introduction"),
    ),
  ).toBe(true);
  expect(answer.sentences.some((s) => s.text.includes("Transformer"))).toBe(
    true,
  );
  const override = await retrieve({
    papers: [paper],
    index,
    request: { ...request, filters: { section: "Methods" } },
  });
  expect(override.debug.filters.section).toBe("Methods");
  expect(
    override.chunks.every((chunk) =>
      chunk.sectionPath.some((path) => path.includes("Methods")),
    ),
  ).toBe(true);
  const overview = await retrieve({
    papers: [paper],
    index,
    request: assistRequestSchema.parse({
      paperId: paper.id,
      action: "summarize",
      query: "Summarize methods and limitations",
    }),
  });
  expect(overview.debug.filters.section).toBeUndefined();
  expect(
    new Set(overview.chunks.map((chunk) => chunk.sectionPath.at(-1))).size,
  ).toBeGreaterThan(1);
});

test("related work preserves short bibliographic titles with exact supporting quotations", async () => {
  for (const [title, entry] of [
    [
      "Random forests.",
      "Leo Breiman. Random forests. Machine Learning, 45(1):5–32, 2001.",
    ],
    [
      "BERT.",
      "Jacob Devlin and colleagues. BERT. A cited verification entry from 2018.",
    ],
  ]) {
    if (!title || !entry) throw new Error("Missing short-title fixture");
    const paper = syntheticPaper(`short-title-${title}`, entry);
    paper.outline = [{ title: "References", page: 1, depth: 0 }];
    const answer = await answerQuestion({
      papers: [paper],
      request: assistRequestSchema.parse({
        paperId: paper.id,
        action: "related",
        query: "Find related papers",
      }),
    });
    expect(answer.refused).toBe(false);
    expect(answer.sentences.some((sentence) => sentence.text === title)).toBe(
      true,
    );
    expect(
      answer.sentences
        .flatMap((sentence) => sentence.citations)
        .every((citation) => entry.includes(citation.quote)),
    ).toBe(true);
  }
});

function samePageSections(duplicate = false) {
  const methods = "The method uses a blue laser to measure atomic motion.";
  const results = duplicate
    ? methods
    : "The results show a measured accuracy of ninety percent.";
  const paper = syntheticPaper("same-page-sections");
  const page = paper.pages[0];
  if (!page) throw new Error("Missing page");
  page.spans = [
    {
      text: "Methods",
      rect: { x: 40, y: 40, width: 400, height: 18 },
      fontSize: 18,
    },
    {
      text: methods,
      rect: { x: 40, y: 80, width: 450, height: 12 },
      fontSize: 12,
    },
    {
      text: "Results",
      rect: { x: 40, y: 140, width: 400, height: 18 },
      fontSize: 18,
    },
    {
      text: results,
      rect: { x: 40, y: 180, width: 450, height: 12 },
      fontSize: 12,
    },
  ];
  page.text = page.spans.map((span) => span.text).join("\n\n");
  paper.outline = [
    { title: "Methods", page: 1, depth: 0 },
    { title: "Results", page: 1, depth: 0 },
  ];
  return { paper, page, results };
}

test("selected Results passage wins over broad same-page Methods context", async () => {
  const { paper, page, results } = samePageSections();
  const answer = await answerQuestion({
    papers: [paper],
    request: assistRequestSchema.parse({
      paperId: paper.id,
      action: "summarize",
      query: "Summarize the selected section",
      selection: { text: results, context: page.text, page: 1 },
    }),
  });
  expect(answer.refused).toBe(false);
  expect(answer.debug.filters.section).toBe("Results");
  expect(
    answer.debug.hits.every((hit) => hit.chunk.sectionPath.includes("Results")),
  ).toBe(true);
  expect(answer.sentences.map((sentence) => sentence.text).join(" ")).toContain(
    "ninety percent",
  );
});

test("PDF selection coordinates distinguish identical passages in different sections", async () => {
  const { paper, page, results } = samePageSections(true);
  const rect = page.spans.at(-1)?.rect;
  if (!rect) throw new Error("Missing selected bounds");
  const answer = await answerQuestion({
    papers: [paper],
    request: assistRequestSchema.parse({
      paperId: paper.id,
      action: "summarize",
      query: "Summarize the selected section",
      selection: { text: results, context: page.text, page: 1, rects: [rect] },
    }),
  });
  expect(answer.refused).toBe(false);
  expect(answer.debug.filters.section).toBe("Results");
  expect(
    answer.sentences
      .flatMap((sentence) => sentence.citations)
      .flatMap((citation) => citation.rects)
      .every((box) => box.y === rect.y),
  ).toBe(true);
});
