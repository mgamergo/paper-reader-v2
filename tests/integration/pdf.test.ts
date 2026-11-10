import { describe, expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { makeReaderFixture } from "../../scripts/make-reader-fixture";
import { parsePdf } from "../../lib/server/pdf";
describe("real PDF text ingestion", () => {
  test("extracts page text, actual coordinates, metadata, outline, references", async () => {
    const result = await parsePdf(await makeReaderFixture(), "fixture.pdf");
    expect(result.title).toBe("Contextual Reading and Attention");
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]?.text).toContain(
      "attention assigns different weights",
    );
    const span = result.pages[0]?.spans.find((s) =>
      s.text.includes("attention assigns"),
    );
    expect(span?.rect.width).toBeGreaterThan(10);
    expect(span?.rect.y).toBeGreaterThan(0);
    expect(result.outline.some((item) => item.title.includes("Methods"))).toBe(
      true,
    );
    expect(result.references).toHaveLength(2);
    expect(result.references[0]?.pdfUrl).toContain("1706.03762");
    expect(result.abstract).toContain("weights input");
  }, 20000);
  test("rejects mislabeled files and scanned PDFs instead of indexing empty text", async () => {
    await expect(
      parsePdf(new TextEncoder().encode("not a PDF"), "fake.pdf"),
    ).rejects.toThrow("not a PDF");
    const pdf = await PDFDocument.create();
    pdf.addPage();
    await expect(parsePdf(await pdf.save(), "scanned.pdf")).rejects.toThrow(
      "OCR",
    );
  }, 20000);
});
