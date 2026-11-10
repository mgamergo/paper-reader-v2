import {
  test,
  expect,
  annotations,
  openPaper,
  assist,
} from "./acceptance-support";
import type { Locator } from "@playwright/test";

async function expectPassageInViewport(locator: Locator) {
  await expect
    .poll(() =>
      locator
        .evaluate((element) => {
          const area = element.closest(".pdf-scroll");
          if (!area) return false;
          const passage = element.getBoundingClientRect();
          const bounds = area.getBoundingClientRect();
          return (
            passage.height > 0 &&
            passage.top >= bounds.top - 1 &&
            passage.bottom <= bounds.bottom + 1 &&
            passage.right > bounds.left &&
            passage.left < bounds.right
          );
        })
        .catch(() => false),
    )
    .toBe(true);
}

test("high-zoom search and annotation/chat source jumps reveal the actual passage", async ({
  page,
  request,
  owned,
}) => {
  await page.getByLabel("Zoom and fit").selectOption("1.5");
  await page
    .getByRole("button", { name: "Search document", exact: true })
    .click();
  await page.getByLabel("Search PDF text").fill("Weighted output");
  await expectPassageInViewport(page.locator(".current-match").first());
  await page.getByLabel("Scrollable PDF pages").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page
    .getByRole("button", { name: "Next search match", exact: true })
    .click();
  await expectPassageInViewport(page.locator(".current-match").first());
  await page.getByLabel("Search PDF text").fill("");
  await page.getByRole("button", { name: "Close search", exact: true }).click();

  const source = owned.paper.pages[0]?.spans.filter((span) =>
    span.text.includes("Query: current position"),
  )[0];
  if (!source) throw new Error("Expected original table text");
  const saved = await request.post("/api/annotations", {
    data: {
      id: crypto.randomUUID(),
      paperId: owned.paper.id,
      page: 1,
      kind: "note",
      color: "yellow",
      text: source.text,
      comment: "UI review source below fold",
      tags: [],
      rects: [source.rect],
      createdAt: Date.now(),
    },
  });
  expect(saved.ok()).toBe(true);
  expect(await annotations(request, owned.paper.id)).toHaveLength(1);
  await openPaper(page, owned.title);
  await page.getByLabel("Zoom and fit").selectOption("3");
  await page.getByRole("tab", { name: /^Notes/ }).click();
  await page
    .locator(".annotation-card")
    .getByRole("button", { name: "note · page 1", exact: true })
    .click();
  await expectPassageInViewport(page.locator(".citation-flash").first());

  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.locator(".retrieval-controls summary").click();
  await page.getByLabel("Section", { exact: true }).fill("Methods");
  await page
    .getByLabel("Ask a follow-up question")
    .fill("How does a query determine the weights applied to values?");
  const result = await assist(
    page,
    () => page.getByLabel("Ask a follow-up question").press("Enter"),
    "ui-source-viewport",
  );
  expect(result.answer.refused).toBe(false);
  const citation = result.answer.sentences.flatMap(
    (sentence) => sentence.citations,
  )[0];
  expect(citation?.rects.some((rect) => rect.y > 250)).toBe(true);
  await page.getByLabel("Scrollable PDF pages").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page
    .locator(".chat-message.assistant")
    .last()
    .locator(".source-citation")
    .first()
    .click();
  await expectPassageInViewport(page.locator(".citation-flash").first());
});

test("mobile library navigation contains keyboard focus and restores its trigger", async ({
  page,
  owned,
}) => {
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const trigger = page.getByRole("button", {
      name: "Open library navigation",
      exact: true,
    });
    await trigger.click();
    const drawer = page.getByRole("dialog", {
      name: "Library navigation",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await expect
      .poll(() =>
        drawer.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press(index % 2 ? "Tab" : "Shift+Tab");
      expect(
        await drawer.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await drawer
      .getByRole("button", { name: "Add paper", exact: true })
      .click();
    const importer = page.getByRole("dialog", {
      name: "Add a paper",
      exact: true,
    });
    await expect(importer).toBeVisible();
    await expect
      .poll(() =>
        importer.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      )
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(importer).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(
      page.getByRole("heading", { name: owned.title, exact: true }),
    ).toBeVisible();
  }
});
