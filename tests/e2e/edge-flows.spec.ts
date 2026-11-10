import {
  expectRenderedCanvas,
  test,
  expect,
  library,
  upload,
} from "./acceptance-support";
import { paperSchema } from "../../lib/domain";

test("true empty library, fresh citation Add to library and readable source restoration", async ({
  page,
  request,
}) => {
  const initial = await library(request);
  const real = initial.papers.find(
    (p) =>
      p.title === "Attention Is All You Need" &&
      p.sourceUrl?.includes("1706.03762"),
  );
  expect(
    initial.papers.filter((p) => p.id !== real?.id),
    "Empty-library test must never delete unrelated documents",
  ).toEqual([]);
  let authoredId = "";
  try {
    if (real)
      expect((await request.delete(`/api/papers/${real.id}`)).ok()).toBe(true);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Make room for your next idea" }),
    ).toBeVisible();
    await expect(page.locator(".paper-row")).toHaveCount(0);
    const authored = await upload(
      page,
      `Acceptance empty library citation ${Date.now()}`,
    );
    authoredId = authored.id;
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
    await page
      .getByRole("button", { name: "Preview reference [1]", exact: true })
      .first()
      .press("ArrowDown");
    await expectRenderedCanvas(
      card.getByLabel("First page of cited paper", { exact: true }),
    );
    const pending = page.waitForResponse(
      (r) => r.url().endsWith("/api/import") && r.request().method() === "POST",
    );
    await card
      .getByRole("button", { name: "Add to library", exact: true })
      .click();
    const response = await pending;
    expect(response.ok(), await response.text()).toBe(true);
    const added = paperSchema.parse(await response.json());
    expect(added.title).toBe("Attention Is All You Need");
    expect(added.pages).toHaveLength(15);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Preview reference [1]", exact: true })
      .first()
      .focus();
    await expect(
      card.getByRole("button", { name: "In your library", exact: true }),
    ).toBeDisabled();
    await expectRenderedCanvas(
      card.getByLabel("First page of cited paper", { exact: true }),
    );
    await expect(
      page.getByText("Resolving metadata…", { exact: true }),
    ).toBeHidden();
    expect((await library(request)).papers.some((p) => p.id === added.id)).toBe(
      true,
    );
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Back to library", exact: true })
      .click();
    await expect(
      page
        .locator(".paper-row")
        .filter({ hasText: "Attention Is All You Need" }),
    ).toBeVisible();
    await page
      .locator(".paper-row")
      .filter({ hasText: "Attention Is All You Need" })
      .click();
    await expect(page.locator(".textLayer")).toContainText([
      "Attention Is All You Need",
    ]);
    await page.waitForLoadState("networkidle");
  } finally {
    if (authoredId)
      expect((await request.delete(`/api/papers/${authoredId}`)).ok()).toBe(
        true,
      );
    let restored = (await library(request)).papers.find(
      (p) =>
        p.title === "Attention Is All You Need" &&
        p.sourceUrl?.includes("1706.03762"),
    );
    if (!restored) {
      const response = await request.post("/api/import", {
        data: { source: "1706.03762" },
      });
      expect(response.ok()).toBe(true);
      restored = paperSchema.parse(await response.json());
    }
    expect((await request.get(`/api/papers/${restored.id}/pdf`)).ok()).toBe(
      true,
    );
    if (real)
      expect(
        (
          await request.patch(`/api/papers/${restored.id}`, {
            data: {
              currentPage: real.currentPage,
              progress: real.progress,
              tags: real.tags,
              collectionIds: real.collectionIds,
            },
          })
        ).ok(),
      ).toBe(true);
    expect(
      (await request.patch("/api/settings", { data: initial.settings })).ok(),
    ).toBe(true);
  }
});

test("figure and table previews show actual source canvases and jump to original", async ({
  page,
  owned,
}) => {
  expect(owned.paper.pages[0]?.text).toContain("Table 1");
  for (const label of ["Preview Fig. 1", "Preview Table 1"]) {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .focus();
    await expect(
      page.getByLabel("Thumbnail of page 1", { exact: true }),
    ).toBeVisible();
    await expectRenderedCanvas(
      page.getByLabel("Thumbnail of page 1", { exact: true }),
    );
    await page
      .getByRole("button", { name: "Go to original · page 1", exact: true })
      .click();
    await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
      "1",
    );
    await page.keyboard.press("Escape");
  }
});

test("reader vim scrolling, themes, page tint and focus mode remain usable", async ({
  page,
  request,
  owned,
}) => {
  const scroll = page.getByLabel("Scrollable PDF pages");
  await scroll.focus();
  await page.keyboard.press("j");
  await expect
    .poll(() => scroll.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("k");
  await expect.poll(() => scroll.evaluate((e) => e.scrollTop)).toBe(0);
  for (const theme of ["dark", "sepia", "light"]) {
    await page.getByLabel("Workspace theme").selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect
      .poll(async () => (await library(request)).settings.theme)
      .toBe(theme);
    expect(
      await page
        .getByLabel("PDF page 1", { exact: true })
        .evaluate((e) => getComputedStyle(e).filter),
    ).toBe("none");
  }
  await page.getByLabel("Tint PDF pages").check();
  await expect
    .poll(async () => (await library(request)).settings.pageAppearance)
    .toBe(true);
  await page.getByLabel("Workspace theme").selectOption("sepia");
  await expect
    .poll(() =>
      page
        .getByLabel("PDF page 1", { exact: true })
        .evaluate((e) => getComputedStyle(e).filter),
    )
    .not.toBe("none");
  await page
    .getByRole("button", { name: "Toggle focus mode", exact: true })
    .click();
  await expect(page.locator(".workspace")).toHaveClass(/focus-mode/);
  await expect(
    page.getByRole("region", { name: `PDF reader: ${owned.title}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Learning workspace" }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Toggle focus mode", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Learning workspace" }),
  ).toBeVisible();
});
