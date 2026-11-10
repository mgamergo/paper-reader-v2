import { expect, test } from "bun:test";
import { retrievalMetrics } from "../../lib/rag/evaluation";
import { citationRects } from "../../lib/rag/citations";
import { chunkPapers } from "../../lib/rag/chunks";
import { syntheticPaper } from "./rag-fixtures";
test("evaluation metrics use independent graded judgments with real denominators", () => {
  const metrics = retrievalMetrics(
    ["noise", "b", "a"],
    new Map([
      ["a", 3],
      ["b", 1],
      ["miss", 2],
    ]),
    3,
  );
  expect(metrics.recallAtK).toBeCloseTo(2 / 3);
  expect(metrics.mrr).toBe(0.5);
  const expected =
    (1 / Math.log2(3) + 7 / Math.log2(4)) /
    (7 + 3 / Math.log2(3) + 1 / Math.log2(4));
  expect(metrics.ndcg).toBeCloseTo(expected);
  expect(retrievalMetrics([], new Map([["a", 1]]), 5)).toEqual({
    recallAtK: 0,
    mrr: 0,
    ndcg: 0,
  });
});
test("citation anchors narrow to the quoted lines instead of the whole child", () => {
  const paper = syntheticPaper();
  const page = paper.pages[0];
  if (!page) throw new Error("fixture");
  page.spans = [
    "First unrelated sentence about noise.",
    "The blue laser measures atomic motion.",
    "Final unrelated sentence about data.",
  ].map((text, i) => ({
    text,
    rect: { x: 40, y: 100 + i * 20, width: 450, height: 12 },
    fontSize: 12,
  }));
  const chunk = chunkPapers([paper])[0];
  if (!chunk) throw new Error("fixture");
  const rects = citationRects(chunk, "The blue laser measures atomic motion.", [
    paper,
  ]);
  expect(chunk.rects.length).toBe(3);
  expect(rects).toEqual([page.spans[1]?.rect]);
});
