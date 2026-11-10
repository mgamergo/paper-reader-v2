import { describe, expect, test } from "bun:test";
import { annotationsMarkdown, escapeBibtex, toBibtex } from "../../lib/export";
import type { Annotation, Paper } from "../../lib/domain";
const paper: Paper = {
  id: "paper-1",
  title: "A {test} & 50% study",
  authors: ["Ada Lovelace", "Jane O'Neil"],
  abstract: "A\\B $x_1$",
  year: 2024,
  venue: "Science #1",
  doi: "10.123/test",
  sourceUrl: "https://example.com/?a=1&b=2",
  pdfUrl: "/api/papers/paper-1/pdf",
  pages: [],
  outline: [],
  references: [],
  tags: [],
  collectionIds: [],
  progress: 0,
  currentPage: 1,
  createdAt: 0,
  status: "ready",
};
const annotation: Annotation = {
  id: "a",
  paperId: paper.id,
  page: 2,
  kind: "highlight",
  text: "A [claim]\nAnother line",
  comment: "Check *evidence*",
  color: "blue",
  rects: [],
  tags: ["method"],
  createdAt: 1,
};
describe("research exports", () => {
  test("escapes every BibTeX metacharacter without recursively escaping substitutions", () => {
    expect(escapeBibtex("{x} & 50% _ # $ ~ ^ \\")).toBe(
      "\\{x\\} \\& 50\\% \\_ \\# \\$ \\textasciitilde{} \\textasciicircum{} \\textbackslash{}",
    );
  });
  test("produces braced BibTeX fields and author separators", () => {
    const output = toBibtex(paper);
    expect(output).toContain("@article{Lovelace2024paper1,");
    expect(output).toContain("author = {Ada Lovelace and Jane O'Neil}");
    expect(output).toContain("title = {A \\{test\\} \\& 50\\% study}");
    expect(output).toContain("journal = {Science \\#1}");
    expect(output.endsWith("\n}\n")).toBe(true);
  });
  test("Markdown filters ownership, sorts pages and preserves multiline quotes safely", () => {
    const output = annotationsMarkdown(paper, [
      annotation,
      { ...annotation, id: "wrong", paperId: "other", text: "private" },
      { ...annotation, id: "earlier", page: 1, text: "First" },
    ]);
    expect(output.indexOf("Page 1")).toBeLessThan(output.indexOf("Page 2"));
    expect(output).toContain("> A \\[claim\\]\n> Another line");
    expect(output).toContain("Check \\*evidence\\*");
    expect(output).not.toContain("private");
    expect(output).toContain("Tags: method");
  });
  test("optional metadata does not create undefined fields", () => {
    const output = toBibtex({
      ...paper,
      year: undefined,
      doi: undefined,
      sourceUrl: undefined,
    });
    expect(output).not.toContain("undefined");
    expect(output).not.toContain("year =");
  });
});
