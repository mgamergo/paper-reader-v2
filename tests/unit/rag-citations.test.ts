import { expect, test } from "bun:test";
import { syntheticPaper } from "./rag-fixtures";
import { chunkPapers } from "../../lib/rag/chunks";
import { citationRects } from "../../lib/rag/citations";
test("identical passages on one page flash the retrieved occurrence rather than the first", () => {
  const paper = syntheticPaper();
  const page = paper.pages[0];
  if (!page) throw new Error("fixture");
  const quote =
    "The detector measures laser motion and records precise observations.";
  const text = Array.from({ length: 4 }, () => quote).join(" ");
  page.spans = [60, 160].map((y) => ({
    text,
    rect: { x: 30, y, width: 450, height: 12 },
    fontSize: 12,
  }));
  page.text = `${text}\n${text}`;
  paper.outline = [];
  const chunks = chunkPapers([paper], 300, 1000);
  expect(chunks).toHaveLength(2);
  const second = chunks[1];
  if (!second) throw new Error("second chunk missing");
  expect(citationRects(second, quote, [paper]).map((rect) => rect.y)).toEqual([
    160,
  ]);
});
