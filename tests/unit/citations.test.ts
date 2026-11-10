import { describe, expect, test } from "bun:test";
import {
  extractDoi,
  parseReferences,
  parseReference,
  resolveCitationLabels,
} from "../../lib/server/citations";
import type { PaperPage } from "../../lib/domain";
function page(text: string): PaperPage {
  return { number: 1, width: 612, height: 792, text, spans: [] };
}
describe("bibliography and inline citation linking", () => {
  test("extracts wrapped numeric references without splitting continuation lines", () => {
    const refs = parseReferences([
      page(
        "1 Introduction\nPrior research [1, 2].\nReferences\n[1] Vaswani, A. Attention Is All You Need. 2017.\nhttps://arxiv.org/abs/1706.03762\n[2] Lewis, P. Retrieval-Augmented Generation. 2020.\nAppendix A\nUnrelated appendix text",
      ),
    ]);
    expect(refs).toHaveLength(2);
    expect(refs[0]?.label).toBe("1");
    expect(refs[0]?.pdfUrl).toBe("https://arxiv.org/pdf/1706.03762");
    expect(refs[1]?.raw).not.toContain("appendix text");
  });
  test("numeric lists and ranges link only known bibliography entries", () => {
    const refs = [1, 2, 3, 5].map((n) =>
      parseReference(`Smith. Study ${n}. 2020.`, String(n)),
    );
    expect(
      resolveCitationLabels("Prior work [1–3, 5, 12].", refs).map(
        (ref) => ref.label,
      ),
    ).toEqual(["1", "2", "3", "5"]);
  });
  test("author-year references match author surname and year", () => {
    const ref = parseReference(
      "Smith, John. Attention and language. 2020.",
      "4",
    );
    expect(resolveCitationLabels("(Smith 2020)", [ref])).toEqual([ref]);
    expect(resolveCitationLabels("Smith 2021", [ref])).toEqual([]);
  });
  test("DOI retains valid parentheses but removes terminal punctuation", () => {
    expect(extractDoi("doi:10.1000/abc(12). ")).toBe("10.1000/abc(12)");
  });
  test("missing bibliography is explicit empty output", () => {
    expect(
      parseReferences([page("A paper with no references section [12].")]),
    ).toEqual([]);
  });
});
