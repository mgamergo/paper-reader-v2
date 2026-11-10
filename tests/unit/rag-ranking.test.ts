import { describe, expect, test } from "bun:test";
import { bm25, tfidf, cosine, rrf } from "../../lib/rag/ranking";

describe("independent rankers", () => {
  test("BM25 implements saturation and length normalization, with a numeric oracle", () => {
    const docs = [
      { id: "a", text: "laser laser motion" },
      { id: "b", text: "motion atomic atomic atomic atomic" },
    ];
    const expected =
      (Math.log(1 + (2 - 1 + 0.5) / (1 + 0.5)) * 2 * 2.2) /
      (2 + 1.2 * (0.25 + (0.75 * 3) / 4));
    expect(bm25(docs, "laser")[0]?.score).toBeCloseTo(expected, 10);
    expect(bm25(docs, "laser", 1.2, 0)[0]?.score).not.toBe(
      bm25(docs, "laser", 1.2, 1)[0]?.score,
    );
    expect(bm25(docs, "laser", 0.2, 0)[0]?.score).not.toBe(
      bm25(docs, "laser", 2, 0)[0]?.score,
    );
    expect(() => bm25(docs, "laser", 1, -1)).toThrow();
  });
  test("TF-IDF uses full-document vector norms independently of BM25", () => {
    const docs = [
      { id: "short", text: "laser" },
      { id: "long", text: "laser motion atomic noise" },
    ];
    const ranked = tfidf(docs, "laser");
    expect(ranked[0]?.id).toBe("short");
    expect(ranked[0]?.score).toBeCloseTo(1);
    expect(ranked[1]?.score).toBeLessThan(0.5);
    expect(tfidf(docs, "unseen")).toEqual([]);
    expect(tfidf(docs, "laser")).not.toEqual(bm25(docs, "laser"));
  });
  test("RRF uses ranks instead of incomparable scores", () => {
    const result = rrf(
      [
        [
          { id: "a", score: 1000 },
          { id: "b", score: 0.1 },
        ],
        [{ id: "b", score: 0.2 }],
      ],
      60,
    );
    expect(result[0]?.id).toBe("b");
    expect(result[0]?.score).toBeCloseTo(1 / 62 + 1 / 61);
    expect(
      rrf([
        [
          { id: "a", score: 1 },
          { id: "a", score: 0.5 },
        ],
      ]).length,
    ).toBe(1);
  });
  test("cosine rejects incompatible vectors", () => {
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 1], [1, 1])).toBeCloseTo(1);
    expect(() => cosine([1], [1, 2])).toThrow();
    expect(() => cosine([NaN], [1])).toThrow();
  });
});
