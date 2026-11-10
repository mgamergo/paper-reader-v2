import {
  test,
  expect,
  library,
  openPaper,
  upload,
  assist,
} from "./acceptance-support";
import { paperSchema, collectionSchema } from "../../lib/domain";

test("arXiv UI import returns cached real bytes and deduplicates library state", async ({
  page,
  request,
}) => {
  const before = await library(request);
  await page.goto("/");
  await page.getByRole("button", { name: "Add paper", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a paper" });
  await dialog.getByLabel("DOI, arXiv ID or public URL").fill("1706.03762");
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/import") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Import paper", exact: true })
    .click();
  const response = await pending;
  expect(response.ok(), await response.text()).toBe(true);
  const paper = paperSchema.parse(await response.json());
  expect(paper.title).toBe("Attention Is All You Need");
  expect(paper.authors).toContain("Ashish Vaswani");
  expect(paper.pages).toHaveLength(15);
  expect(paper.references.length).toBeGreaterThan(30);
  expect(paper.sourceUrl).toMatch(/1706.03762/);
  await expect(dialog).toBeHidden();
  await expect(page.locator(".textLayer")).toContainText([
    "Attention Is All You Need",
  ]);
  const after = await library(request);
  const previous = before.papers.find((p) =>
    p.sourceUrl?.includes("1706.03762"),
  );
  if (previous) expect(paper.id).toBe(previous.id);
  expect(
    after.papers.filter((p) => p.sourceUrl?.includes("1706.03762")),
  ).toHaveLength(1);
  const pdf = await request.get(`/api/papers/${paper.id}/pdf`);
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".textLayer span").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/acceptance-real-paper-${viewport.name}.png`,
    });
  }
});

test("split readers stay independent and collection chat persists scoped history", async ({
  page,
  request,
  owned,
}) => {
  let secondId = "";
  let collectionId = "";
  try {
    const second = await upload(page, `Acceptance comparison ${Date.now()}`);
    secondId = second.id;
    const response = await request.post("/api/collections", {
      data: { name: `Acceptance scope ${Date.now()}`, color: "#3158a0" },
    });
    expect(response.ok()).toBe(true);
    const collection = collectionSchema.parse(await response.json());
    collectionId = collection.id;
    expect(
      (
        await request.patch(`/api/papers/${owned.paper.id}`, {
          data: { collectionIds: [collectionId] },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await request.patch(`/api/papers/${secondId}`, {
          data: { collectionIds: [collectionId] },
        })
      ).ok(),
    ).toBe(true);
    await openPaper(page, owned.title);
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Compare two papers" })
      .getByRole("button", { name: second.title, exact: true })
      .click();
    const primary = page.getByRole("region", {
      name: `PDF reader: ${owned.title}`,
      exact: true,
    });
    const secondary = page.getByRole("region", {
      name: `PDF reader: ${second.title}`,
      exact: true,
    });
    await expect(secondary.locator(".textLayer span").first()).toBeVisible();
    await secondary
      .getByRole("button", { name: "Next page", exact: true })
      .click();
    await expect(
      secondary.getByLabel("Page number", { exact: true }),
    ).toHaveValue("2");
    await expect(
      primary.getByLabel("Page number", { exact: true }),
    ).toHaveValue("1");
    await secondary.getByLabel("Zoom and fit").selectOption("0.75");
    await expect(primary.getByLabel("Zoom and fit")).toHaveValue("width");
    await expect(secondary.getByLabel("Zoom and fit")).toHaveValue("0.75");
    await page
      .getByRole("button", { name: "Close split", exact: true })
      .click();
    await page.getByRole("tab", { name: "Chat", exact: true }).click();
    const collectionHistory = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/chat" &&
        new URL(r.url()).searchParams.get("paperId") ===
          `collection:${collectionId}`,
    );
    await page.getByLabel("Chat scope").selectOption(collectionId);
    await collectionHistory;
    await expect(
      page.getByText("Loading conversation…", { exact: true }),
    ).toBeHidden();
    const question =
      "How does attention assign weights to input representations?";
    await page.getByLabel("Ask a follow-up question").fill(question);
    const result = await assist(
      page,
      () => page.getByLabel("Ask a follow-up question").press("Enter"),
      "collection",
    );
    await expect(page.locator(".chat-message.assistant")).toHaveCount(1);
    await expect(
      page.getByText("Loading conversation…", { exact: true }),
    ).toBeHidden();
    expect(result.request.collectionId).toBe(collectionId);
    expect(result.request.paperId).toBeUndefined();
    expect(result.answer.refused).toBe(false);
    expect(
      result.answer.sentences
        .flatMap((s) => s.citations)
        .every((c) => [owned.paper.id, secondId].includes(c.paperId)),
    ).toBe(true);
    await page.waitForLoadState("networkidle");
    await openPaper(page, owned.title);
    await page.getByRole("tab", { name: "Chat", exact: true }).click();
    const reloadedHistory = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/chat" &&
        new URL(r.url()).searchParams.get("paperId") ===
          `collection:${collectionId}`,
    );
    await page.getByLabel("Chat scope").selectOption(collectionId);
    await reloadedHistory;
    await expect(
      page.getByText("Loading conversation…", { exact: true }),
    ).toBeHidden();
    await expect(
      page.locator(".chat-message.user").filter({ hasText: question }),
    ).toBeVisible();
    const persisted = await request.get(
      `/api/chat?paperId=collection:${collectionId}`,
    );
    expect((await persisted.json()).length).toBe(2);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Chat scope").selectOption("document");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".chat-message.user")).toHaveCount(0);
  } finally {
    if (secondId)
      expect((await request.delete(`/api/papers/${secondId}`)).ok()).toBe(true);
    if (collectionId)
      expect(
        (await request.delete(`/api/collections/${collectionId}`)).ok(),
      ).toBe(true);
  }
});

test("citation card imports the cited real paper and restores the task-owned source", async ({
  page,
  request,
  owned,
}) => {
  const initial = await library(request);
  const source = initial.papers.find(
    (p) =>
      p.title === "Attention Is All You Need" &&
      p.sourceUrl?.includes("1706.03762"),
  );
  try {
    if (source)
      expect((await request.delete(`/api/papers/${source.id}`)).ok()).toBe(
        true,
      );
    await openPaper(page, owned.title);
    await page
      .getByRole("button", { name: "Preview reference [1]", exact: true })
      .first()
      .focus();
    const card = page.locator(".reference-preview");
    await expect(card.getByRole("heading")).toContainText(
      "Attention Is All You Need",
    );
    await expect(
      card.getByRole("button", { name: "Add to library", exact: true }),
    ).toBeEnabled();
    const pending = page.waitForResponse(
      (r) => r.url().endsWith("/api/import") && r.request().method() === "POST",
    );
    await card
      .getByRole("button", { name: "Add to library", exact: true })
      .click();
    const response = await pending;
    expect(response.ok(), await response.text()).toBe(true);
    const imported = paperSchema.parse(await response.json());
    expect(imported.title).toBe("Attention Is All You Need");
    expect(imported.pages).toHaveLength(15);
    await expect(
      card.getByRole("button", { name: "In your library", exact: true }),
    ).toBeDisabled();
    expect(
      (await library(request)).papers.some((p) => p.id === imported.id),
    ).toBe(true);
  } finally {
    let restored = (await library(request)).papers.find(
      (p) =>
        p.title === "Attention Is All You Need" &&
        p.sourceUrl?.includes("1706.03762"),
    );
    if (!restored) {
      const response = await request.post("/api/import", {
        data: { source: "1706.03762" },
      });
      expect(response.ok(), "restore task-owned real source").toBe(true);
      restored = paperSchema.parse(await response.json());
    }
    const pdf = await request.get(`/api/papers/${restored.id}/pdf`);
    expect(pdf.ok()).toBe(true);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    if (source)
      expect(
        (
          await request.patch(`/api/papers/${restored.id}`, {
            data: {
              currentPage: source.currentPage,
              progress: source.progress,
              tags: source.tags,
              collectionIds: source.collectionIds,
            },
          })
        ).ok(),
      ).toBe(true);
  }
});
