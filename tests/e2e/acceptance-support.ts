import { test as base, expect } from "./fixtures";
import type { APIRequestContext, Page, Locator } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { z } from "zod";
import {
  librarySchema,
  paperSchema,
  annotationSchema,
  assistRequestSchema,
  answerSchema,
} from "../../lib/domain";
import { mkdir, writeFile, readFile } from "node:fs/promises";

export async function expectRenderedCanvas(canvas: Locator) {
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) return false;
        const context = element.getContext("2d");
        if (!context || !element.width || !element.height) return false;
        const pixels = context.getImageData(
          0,
          0,
          element.width,
          element.height,
        ).data;
        let ink = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            (pixels[i + 3] ?? 0) > 0 &&
            (pixels[i] ?? 255) < 200 &&
            (pixels[i + 1] ?? 255) < 200 &&
            (pixels[i + 2] ?? 255) < 200
          )
            ink++;
        return ink > 20;
      }),
    )
    .toBe(true);
}
export async function library(request: APIRequestContext) {
  const response = await request.get("/api/library");
  expect(response.ok()).toBeTruthy();
  return librarySchema.parse(await response.json());
}
export async function annotations(request: APIRequestContext, id: string) {
  const response = await request.get(`/api/annotations?paperId=${id}`);
  expect(response.ok()).toBeTruthy();
  return z.array(annotationSchema).parse(await response.json());
}
export async function openPaper(page: Page, title: string) {
  await page.goto("/");
  await expect(
    page.locator(".library-view, .pdf-reader").first(),
  ).toBeVisible();
  const resumed = page.getByRole("region", {
    name: `PDF reader: ${title}`,
    exact: true,
  });
  if (await resumed.isVisible()) {
    await expect(resumed.locator(".textLayer span").first()).toBeVisible({
      timeout: 20000,
    });
    await page.waitForLoadState("networkidle");
    return;
  }
  const back = page.getByRole("button", {
    name: "Back to library",
    exact: true,
  });
  if (await back.isVisible()) {
    await expect(page.locator(".textLayer span").first()).toBeVisible({
      timeout: 20000,
    });
    await page.waitForLoadState("networkidle");
    await back.click();
  }
  await page.locator(".paper-row").filter({ hasText: title }).click();
  await expect(page.locator(".textLayer span").first()).toBeVisible({
    timeout: 20000,
  });
}
export async function upload(page: Page, title: string) {
  const pdf = await PDFDocument.load(
    await readFile("tests/fixtures/reader/contextual-reading.pdf"),
  );
  pdf.setTitle(title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.getPages()[1]?.drawText(title, { x: 50, y: 60, size: 8, font });
  await page.getByRole("button", { name: "Add paper", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a paper" });
  await dialog.getByLabel("Upload PDF").setInputFiles({
    name: `${title}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  const result = page.waitForResponse(
    (r) => r.url().endsWith("/api/import") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Import paper", exact: true })
    .click();
  const response = await result;
  expect(response.ok(), await response.text()).toBeTruthy();
  const paper = paperSchema.parse(await response.json());
  await expect(dialog).toBeHidden();
  await expect(page.locator(".textLayer span").first()).toBeVisible({
    timeout: 20000,
  });
  return paper;
}
export async function selectText(
  page: Page,
  text = "Attention is a mechanism",
) {
  const span = page
    .locator('[data-page-number="1"] .textLayer span')
    .filter({ hasText: text })
    .first();
  await span.scrollIntoViewIfNeeded();
  const box = await span.boundingBox();
  if (!box) throw new Error("Text glyph bounds unavailable");
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toContain(text);
  await expect(page.getByLabel("Selected text actions")).toBeVisible();
}
export async function assist(
  page: Page,
  action: () => Promise<unknown>,
  name: string,
) {
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/assist") && r.request().method() === "POST",
  );
  await action();
  const response = await pending;
  const request = assistRequestSchema.parse(response.request().postDataJSON());
  const raw: unknown = await response.json();
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    `artifacts/e2e-assist-${name}.json`,
    JSON.stringify(
      { status: response.status(), request, response: raw },
      null,
      2,
    ),
  );
  expect(response.ok(), JSON.stringify(raw)).toBeTruthy();
  const answer = answerSchema.parse(raw);
  await expect(
    page.getByText("Finding evidence and preparing an explanation…"),
  ).toBeHidden();
  return { request, answer };
}
export const test = base.extend<{
  owned: { paper: z.infer<typeof paperSchema>; title: string };
}>({
  owned: async ({ page, request }, provide, testInfo) => {
    const initial = await library(request);
    const created: string[] = [];
    const title = `Acceptance ${testInfo.title.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 45)} ${Date.now()}`;
    page.on("response", async (response) => {
      if (response.url().endsWith("/api/import") && response.ok()) {
        const result = paperSchema.safeParse(
          await response.json().catch(() => null),
        );
        if (
          result.success &&
          result.data.title === title &&
          !initial.papers.some((p) => p.id === result.data.id)
        )
          created.push(result.data.id);
      }
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    try {
      const paper = await upload(page, title);
      created.push(paper.id);
      expect(paper.pages).toHaveLength(2);
      expect(paper.pages[0]?.text).toContain("Attention is a mechanism");
      await provide({ paper, title });
    } finally {
      for (const id of new Set(created)) {
        if (!(await library(request)).papers.some((p) => p.id === id)) continue;
        const response = await request.delete(`/api/papers/${id}`);
        expect(response.ok(), `cleanup paper ${id}`).toBeTruthy();
      }
      const restored = await request.patch("/api/settings", {
        data: initial.settings,
      });
      expect(restored.ok(), "restore original settings").toBeTruthy();
      const after = await library(request);
      expect(after.papers.filter((p) => created.includes(p.id))).toEqual([]);
      expect(after.settings).toEqual(initial.settings);
      await writeFile(
        `artifacts/e2e-cleanup-${testInfo.testId.replace(/[^a-zA-Z0-9]/g, "")}.json`,
        JSON.stringify({
          title,
          deleted: [...new Set(created)],
          settingsRestored: true,
        }),
      );
    }
  },
});
export { expect };
