import { expect, test } from "bun:test";
import { z } from "zod";
import { paperSchema, assistRequestSchema } from "../../lib/domain";
import { buildIndex, retrieve, answerQuestion } from "../../lib/rag";
import { judgmentSchema, normalizePassage } from "../../lib/rag/evaluation";
const fixture = z.object({
  provenance: z.object({
    license: z.string(),
    pdfSha256: z.string().length(64),
    source: z.string().url(),
  }),
  paper: paperSchema,
});
test("real arXiv fixtures retain provenance and every positive judgment exists in source chunks", async () => {
  const sources = await Promise.all(
    ["2402.00838v4", "2101.00027v1"].map(async (id) =>
      fixture.parse(await Bun.file(`tests/fixtures/rag/${id}.json`).json()),
    ),
  );
  expect(sources.every((f) => f.provenance.license.includes("/by/4.0/"))).toBe(
    true,
  );
  const index = await buildIndex(sources.map((f) => f.paper));
  const judgments = z
    .array(judgmentSchema)
    .parse(await Bun.file("tests/fixtures/rag/judgments.json").json());
  for (const j of judgments.filter((j) => !j.negative))
    expect(
      index.chunks.some(
        (c) =>
          c.paperId === j.paperId &&
          c.page === j.page &&
          normalizePassage(c.text).includes(normalizePassage(j.passage)),
      ),
    ).toBe(true);
  expect(
    new Set(
      judgments.filter((j) => j.split === "dev").map((j) => j.query),
    ).intersection(
      new Set(judgments.filter((j) => j.split === "test").map((j) => j.query)),
    ).size,
  ).toBe(0);
});
test("real-paper retrieval finds specific evidence, and unrelated medical questions refuse", async () => {
  const papers = (
    await Promise.all(
      ["2402.00838v4", "2101.00027v1"].map(async (id) =>
        fixture.parse(await Bun.file(`tests/fixtures/rag/${id}.json`).json()),
      ),
    )
  ).map((f) => f.paper);
  const index = await buildIndex(papers);
  const result = await retrieve({
    papers,
    index,
    request: assistRequestSchema.parse({
      query: "Which AMD GPUs were used on LUMI for OLMo?",
    }),
    rewrite: false,
    multiQuery: false,
    hyde: false,
    expandParents: false,
    topK: 5,
  });
  expect(
    result.chunks.some(
      (c) =>
        c.paperId === "2402.00838v4" &&
        c.page === 5 &&
        c.text.includes("MI250X"),
    ),
  ).toBe(true);
  const answer = await answerQuestion({
    papers,
    index,
    request: assistRequestSchema.parse({
      query: "What dosage cures pancreatic cancer?",
    }),
  });
  expect(answer.refused).toBe(true);
});

test("full contextual retrieval passes every unchanged real-paper answer and passage judgment", async () => {
  const papers = (
    await Promise.all(
      ["2402.00838v4", "2101.00027v1"].map(async (id) =>
        fixture.parse(await Bun.file(`tests/fixtures/rag/${id}.json`).json()),
      ),
    )
  ).map((source) => source.paper);
  const index = await buildIndex(papers);
  const judgments = z
    .array(judgmentSchema)
    .parse(await Bun.file("tests/fixtures/rag/judgments.json").json());
  for (const production of [false, true]) {
    for (const judgment of judgments.filter((j) => j.split === "test")) {
      const options = {
        papers,
        index,
        request: assistRequestSchema.parse({ query: judgment.query }),
        rewrite: production,
        multiQuery: production,
        hyde: production,
        expandParents: production,
        topK: 5,
        candidateK: 24,
        rerank: true,
      };
      const answer = await answerQuestion(options);
      if (judgment.negative) {
        expect(answer.refused, judgment.id).toBe(true);
        continue;
      }
      const retrieval = await retrieve(options);
      expect(
        retrieval.chunks.some(
          (chunk) =>
            chunk.paperId === judgment.paperId &&
            chunk.page === judgment.page &&
            normalizePassage(chunk.text).includes(
              normalizePassage(judgment.passage),
            ),
        ),
        `${judgment.id} expected passage`,
      ).toBe(true);
      expect(answer.refused, `${judgment.id} answer available`).toBe(false);
      const text = normalizePassage(
        answer.sentences.map((sentence) => sentence.text).join(" "),
      );
      for (const pattern of judgment.answerPatterns)
        expect(
          new RegExp(pattern, "i").test(text),
          `${judgment.id}: ${pattern}`,
        ).toBe(true);
    }
  }
}, 60000);
