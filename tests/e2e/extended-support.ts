import type { Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { expect } from "./fixtures";
import { paperSchema } from "../../lib/domain";

export async function uniquePdf(title: string): Promise<Buffer> {
  const pdf = await PDFDocument.load(
    await readFile("tests/fixtures/reader/contextual-reading.pdf"),
  );
  pdf.setTitle(title);
  pdf.setProducer(title);
  return Buffer.from(await pdf.save());
}

export async function openImport(page: Page) {
  await page.getByRole("button", { name: "Add paper", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a paper", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function submitImport(page: Page) {
  const pending = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/import" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("dialog", { name: "Add a paper", exact: true })
    .getByRole("button", { name: "Import paper", exact: true })
    .click();
  return pending;
}

export async function importBytes(page: Page, title: string, buffer: Buffer) {
  const dialog = await openImport(page);
  await dialog.getByLabel("Upload PDF").setInputFiles({
    name: `${title}.pdf`,
    mimeType: "application/pdf",
    buffer,
  });
  const response = await submitImport(page);
  expect(response.ok(), await response.text()).toBe(true);
  const paper = paperSchema.parse(await response.json());
  await expect(dialog).toBeHidden();
  await expect(page.locator(".textLayer span").first()).toBeVisible();
  return paper;
}

export async function citationVariantsPdf(title: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor("Reader acceptance team");
  pdf.setSubject("Original verification fixture; not a published study");
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const page = pdf.addPage([612, 792]);
  const lines = [
    "Citation variations in an original verification fixture",
    "Grouped evidence [1, 2] connects two bibliography entries.",
    "Ranged evidence [1-2] connects the same two entries.",
    "Narrative Smith (2020) describes the authored example.",
    "Unknown evidence [99] must remain explicitly unresolved.",
    "Raised evidence",
    "References",
    "[1] Ashish Vaswani, Noam Shazeer. Attention Is All You Need. 2017.",
    "https://arxiv.org/abs/1706.03762",
    "[2] Smith, Jane. Contextual citation example. Original verification fixture. 2020.",
  ];
  let y = 735;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font });
    if (line === "Raised evidence")
      page.drawText("2", { x: 125, y: y + 6, size: 7, font });
    y -= 32;
  }
  return Buffer.from(await pdf.save());
}
