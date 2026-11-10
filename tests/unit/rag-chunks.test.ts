import { expect, test } from "bun:test";
import { chunkPapers } from "../../lib/rag/chunks";
import { syntheticPaper } from "./rag-fixtures";

test("two columns are read down each column, not across unrelated lines", () => {
  const paper = syntheticPaper();
  const page = paper.pages[0];
  if (!page) throw new Error("fixture");
  page.spans = Array.from({ length: 5 }, (_, i) => [
    {
      text: `Left passage ${i}.`,
      rect: { x: 40, y: 100 + i * 20, width: 200, height: 12 },
      fontSize: 12,
    },
    {
      text: `Right passage ${i}.`,
      rect: { x: 320, y: 100 + i * 20, width: 200, height: 12 },
      fontSize: 12,
    },
  ]).flat();
  const chunks = chunkPapers([paper], 500, 1200);
  expect(chunks[0]?.text.indexOf("Left passage 4")).toBeLessThan(
    chunks[0]?.text.indexOf("Right passage 0") ?? -1,
  );
  expect(chunks[0]?.rects.length).toBe(10);
});
test("parents are page-local and children preserve section and kind", () => {
  const paper = syntheticPaper();
  const page = paper.pages[0];
  if (!page) throw new Error("fixture");
  page.spans = [
    {
      text: "2 Methods",
      rect: { x: 30, y: 50, width: 400, height: 18 },
      fontSize: 18,
    },
    ...Array.from({ length: 20 }, (_, i) => ({
      text: `The detector measures laser motion sample ${i}.`,
      rect: { x: 30, y: 100 + i * 15, width: 450, height: 12 },
      fontSize: 12,
    })),
    {
      text: "Figure 1. Detector arrangement.",
      rect: { x: 30, y: 500, width: 450, height: 12 },
      fontSize: 12,
    },
  ];
  paper.pages.push({ ...page, number: 2 });
  const chunks = chunkPapers([paper], 220, 900);
  expect(chunks.every((chunk) => !chunk.text.startsWith("2 Methods"))).toBe(
    true,
  );
  expect(
    chunks.filter((c) => c.page === 1 && c.kind === "text").length,
  ).toBeGreaterThan(2);
  expect(chunks.some((c) => c.kind === "figure")).toBe(true);
  expect(
    chunks
      .filter((c) => c.kind === "text")
      .every((c) => c.sectionPath.includes("2 Methods")),
  ).toBe(true);
  expect(chunks.every((c) => c.parentText.includes(c.text))).toBe(true);
  expect(
    new Set(
      chunks.filter((c) => c.page === 1).map((c) => c.parentId),
    ).intersection(
      new Set(chunks.filter((c) => c.page === 2).map((c) => c.parentId)),
    ).size,
  ).toBe(0);
});

test("baseline grouping preserves prose around smaller mathematical subscripts", () => {
  const paper = syntheticPaper();
  const page = paper.pages[0];
  if (!page) throw new Error("fixture");
  page.spans = [
    {
      text: "We divide by d",
      rect: { x: 40, y: 100, width: 75, height: 12 },
      fontSize: 12,
    },
    { text: "k", rect: { x: 116, y: 107, width: 4, height: 7 }, fontSize: 7 },
    {
      text: "and apply softmax to obtain weights.",
      rect: { x: 125, y: 100, width: 240, height: 12 },
      fontSize: 12,
    },
    {
      text: "A separate second line follows.",
      rect: { x: 40, y: 118, width: 300, height: 12 },
      fontSize: 12,
    },
  ];
  const chunk = chunkPapers([paper])[0];
  expect(chunk?.text).toContain(
    "We divide by d k and apply softmax to obtain weights. A separate second line",
  );
});

test("zero-based native outline depth preserves root, child and grandchild ancestry", () => {
  const paper = syntheticPaper();
  const page = paper.pages[0];
  if (!page) throw new Error("fixture");
  paper.outline = [
    { title: "Architecture", depth: 0, page: 1 },
    { title: "Attention", depth: 1, page: 2 },
    { title: "Scaled attention", depth: 2, page: 3 },
  ];
  paper.pages = [{ ...page, number: 3 }];
  const chunk = chunkPapers([paper])[0];
  expect(chunk?.sectionPath).toEqual([
    "Architecture",
    "Attention",
    "Scaled attention",
  ]);
});
test("detected bibliography continues across pages and an appendix resets it", () => {
  const paper = syntheticPaper();
  const page = paper.pages[0];
  if (!page) throw new Error("fixture");
  paper.outline = [];
  paper.pages = [
    {
      ...page,
      number: 1,
      spans: [
        {
          ...page.spans[0],
          text: "References",
          rect: { x: 40, y: 40, width: 300, height: 18 },
          fontSize: 18,
        },
      ],
    },
    { ...page, number: 2 },
    {
      ...page,
      number: 3,
      spans: [
        {
          ...page.spans[0],
          text: "Appendix A Additional Experiments",
          rect: { x: 40, y: 40, width: 450, height: 18 },
          fontSize: 18,
        },
        ...page.spans,
      ],
    },
  ];
  const chunks = chunkPapers([paper]);
  expect(
    chunks.filter((c) => c.page === 2).every((c) => c.kind === "references"),
  ).toBe(true);
  expect(
    chunks.filter((c) => c.page === 3).every((c) => c.kind !== "references"),
  ).toBe(true);
});
