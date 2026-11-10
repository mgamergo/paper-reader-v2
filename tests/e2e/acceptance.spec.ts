import {
  expectRenderedCanvas,
  test,
  expect,
  library,
  annotations,
  openPaper,
  selectText,
  assist,
} from "./acceptance-support";
import { readFile } from "node:fs/promises";

test("upload, metadata, search, tags, collection membership and safe deletion", async ({
  page,
  request,
  owned,
}) => {
  const name = `Acceptance collection ${Date.now()}`;
  let collectionId = "";
  try {
    expect(
      (await library(request)).papers.some((p) => p.id === owned.paper.id),
    ).toBe(true);
    await page.getByRole("button", { name: "Back to library" }).click();
    await page.getByLabel("Search library").fill("no-such-acceptance-paper");
    await expect(
      page.getByText("No matching papers", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Search library").fill("");
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await page.getByLabel("Collection name").fill(name);
    await page
      .getByRole("button", { name: "Create collection", exact: true })
      .click();
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    collectionId =
      (await library(request)).collections.find((c) => c.name === name)?.id ??
      "";
    expect(collectionId).not.toBe("");
    await page.locator(".paper-row").filter({ hasText: owned.title }).click();
    await page
      .getByRole("button", { name: "Paper details", exact: true })
      .click();
    const details = page.getByRole("dialog", { name: "Paper details" });
    await details
      .getByLabel("Title", { exact: true })
      .fill(`${owned.title} Edited`);
    await details
      .getByLabel("Authors (one per line)")
      .fill("Acceptance Author");
    await details.getByLabel("Year", { exact: true }).fill("2026");
    await details
      .getByLabel("Tags (comma separated)")
      .fill("acceptance, attention");
    await details.getByLabel(name, { exact: true }).check();
    await details.getByRole("button", { name: "Save changes" }).click();
    await expect(details).toBeHidden();
    await page.getByRole("button", { name: "Back to library" }).click();
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByLabel("Search library").fill("Acceptance Author");
    await page.getByLabel("Filter by tag").selectOption("acceptance");
    await page.getByLabel("Sort papers").selectOption("title");
    await expect(page.locator(".paper-row")).toHaveCount(1);
    await expect(page.locator(".paper-row")).toContainText(
      `${owned.title} Edited`,
    );
    const saved = (await library(request)).papers.find(
      (p) => p.id === owned.paper.id,
    );
    expect(saved?.collectionIds).toContain(collectionId);
    expect(saved?.tags).toEqual(["acceptance", "attention"]);
    await page.reload();
    await page
      .getByRole("button", { name: "Back to library", exact: true })
      .click();
    await page
      .locator(".paper-row")
      .filter({ hasText: `${owned.title} Edited` })
      .click();
    await page
      .getByRole("button", { name: "Paper details", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete paper…", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete paper permanently", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your library" }),
    ).toBeVisible();
    expect(
      (await library(request)).papers.some((p) => p.id === owned.paper.id),
    ).toBe(false);
    await page
      .getByRole("button", { name: `Delete collection ${name}`, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Delete collection?" })
      .getByRole("button", { name: "Delete collection", exact: true })
      .click();
    await expect(page.getByRole("button", { name, exact: true })).toBeHidden();
  } finally {
    if (
      collectionId &&
      (await library(request)).collections.some((c) => c.id === collectionId)
    )
      expect(
        (await request.delete(`/api/collections/${collectionId}`)).ok(),
      ).toBe(true);
  }
});

test("reader navigation, modes, progress, zoom, rotate, outline and thumbnails", async ({
  page,
  request,
  owned,
}) => {
  const number = page.getByRole("spinbutton", {
    name: "Page number",
    exact: true,
  });
  await page.getByRole("button", { name: "Continuous", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Single page", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".pdf-page")).toHaveCount(1);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(number).toHaveValue("2");
  await expect(page.locator('[data-page-number="2"] .textLayer')).toContainText(
    "Results and limitations",
  );
  await expect
    .poll(
      async () =>
        (await library(request)).papers.find((p) => p.id === owned.paper.id)
          ?.currentPage,
    )
    .toBe(2);
  await openPaper(page, owned.title);
  await expect(number).toHaveValue("2");
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(number).toHaveValue("1");
  await number.fill("2");
  await number.press("Enter");
  await expect(number).toHaveValue("2");
  await number.fill("1");
  await number.press("Enter");
  const canvas = page.getByLabel("PDF page 1", { exact: true });
  const before = await canvas.boundingBox();
  await page.getByLabel("Zoom and fit").selectOption("1.5");
  await expect
    .poll(async () => (await canvas.boundingBox())?.width)
    .toBeGreaterThan(before?.width ?? 0);
  await page.getByLabel("Zoom and fit").selectOption("page");
  await page
    .getByRole("button", { name: "Rotate clockwise", exact: true })
    .click();
  await expect
    .poll(async () => {
      const b = await canvas.boundingBox();
      return !!b && b.width > b.height;
    })
    .toBe(true);
  await page.getByRole("button", { name: "Outline", exact: true }).click();
  await page
    .getByRole("complementary", { name: "outline" })
    .getByRole("button")
    .filter({ hasText: "Results and limitations" })
    .click();
  await expect(number).toHaveValue("2");
  await page.getByRole("button", { name: "Thumbnails", exact: true }).click();
  await expect(
    page.getByLabel("Thumbnail of page 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("complementary", { name: "thumbnails" })
    .getByRole("button")
    .filter({ hasText: "Page 1" })
    .click();
  await expect(number).toHaveValue("1");
});

test("real text selection, copy and visible search match navigation", async ({
  page,
  context,
  owned,
}) => {
  expect(owned.paper.status).toBe("ready");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await selectText(page);
  const selected = await page.evaluate(() => window.getSelection()?.toString());
  await page.keyboard.press("Control+c");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    selected,
  );
  await page.getByRole("button", { name: "Close selection actions" }).click();
  await page
    .getByRole("button", { name: "Search document", exact: true })
    .click();
  const search = page.getByLabel("Search PDF text");
  await search.fill("attention");
  await expect(page.locator(".search-mark").first()).toBeVisible();
  await expect(page.locator(".pdf-search output")).toHaveText(/^1 \/ \d+$/);
  await search.press("Enter");
  await expect(page.locator(".pdf-search output")).toHaveText(/^2 \/ \d+$/);
  await search.press("Shift+Enter");
  await expect(page.locator(".pdf-search output")).toHaveText(/^1 \/ \d+$/);
  await page.getByRole("button", { name: "Next search match" }).click();
  await expect(page.locator(".current-match").first()).toBeVisible();
  await page.getByRole("button", { name: "Previous search match" }).click();
  await expect(page.locator(".pdf-search output")).toHaveText(/^1 \/ \d+$/);
  await search.fill("notpresentacceptance");
  await expect(page.locator(".pdf-search output")).toHaveText("No matches");
  await expect(page.locator(".search-mark")).toHaveCount(0);
});

test("multicolor annotation CRUD, bookmark, persistence and downloaded exports", async ({
  page,
  request,
  owned,
}) => {
  for (const color of ["green", "pink"]) {
    await selectText(page);
    await page
      .getByLabel("Selected text actions")
      .getByRole("button", { name: "Highlight", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Save annotation" });
    await dialog.getByRole("radio", { name: color, exact: true }).check();
    await dialog
      .getByLabel("Note or comment")
      .fill(`Acceptance ${color} comment`);
    await dialog
      .getByLabel("Tags (comma separated)")
      .fill("acceptance, selected");
    await dialog
      .getByRole("button", { name: "Save annotation", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(
      page.locator(`.annotation-mark.mark-${color}`).first(),
    ).toBeVisible();
  }
  const records = await annotations(request, owned.paper.id);
  expect(records).toHaveLength(2);
  expect(
    records.every((a) => a.rects.length > 0 && a.text.includes("Attention")),
  ).toBe(true);
  await page.getByLabel("Scrollable PDF pages").focus();
  await page.keyboard.press("b");
  const bookmark = page.getByRole("dialog", { name: "Bookmark page" });
  await bookmark.getByLabel("Note or comment").fill("Acceptance bookmark");
  await bookmark
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await expect(bookmark).toBeHidden();
  await page.getByRole("tab", { name: /^Notes/ }).click();
  await expect(page.locator(".annotation-card")).toHaveCount(3);
  const card = page
    .locator(".annotation-card")
    .filter({ hasText: "Acceptance green comment" });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Save annotation" });
  await edit.getByLabel("Note or comment").fill("Edited acceptance note");
  await edit
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("note");
  await edit
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await expect(edit).toBeHidden();
  for (const [button, pattern] of [
    ["Export Markdown", /Edited acceptance note/],
    ["Export BibTeX", /@article\{[\s\S]*title\s*=\s*\{/],
  ] satisfies [string, RegExp][]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: button }).click();
    const file = await download;
    const path = await file.path();
    if (!path) throw new Error("download missing");
    expect(await readFile(path, "utf8")).toMatch(pattern);
  }
  await openPaper(page, owned.title);
  await page.getByRole("tab", { name: /^Notes/ }).click();
  await expect(page.locator(".annotation-card")).toHaveCount(3);
  await page.getByLabel("Search annotations").fill("Edited acceptance note");
  await expect(page.locator(".annotation-card")).toHaveCount(1);
  await page
    .locator(".annotation-card")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.locator(".annotation-card")).toHaveCount(0);
  expect(await annotations(request, owned.paper.id)).toHaveLength(2);
});

test("double click and context Explain carry selection, language and difficulty", async ({
  page,
  owned,
}) => {
  expect(owned.paper.status).toBe("ready");
  await page.getByLabel("Default explanation language").selectOption("Telugu");
  await page.getByLabel("Explanation difficulty").fill("4");
  const word = page
    .locator('[data-page-number="1"] .textLayer span')
    .filter({ hasText: "Attention is a mechanism" })
    .first();
  await word.scrollIntoViewIfNeeded();
  const wordBox = await word.boundingBox();
  if (!wordBox) throw new Error("Missing glyph bounds");
  await page.mouse.dblclick(wordBox.x + 20, wordBox.y + wordBox.height / 2);
  await expect(page.getByLabel("Selected text actions")).toBeVisible();
  await page.mouse.click(wordBox.x + 20, wordBox.y + wordBox.height / 2, {
    button: "right",
  });
  const result = await assist(
    page,
    () =>
      page
        .getByLabel("Selected text actions")
        .getByRole("button", { name: "Explain", exact: true })
        .click(),
    "selection",
  );
  expect(result.request.action).toBe("explain");
  expect(result.request.language).toBe("Telugu");
  expect(result.request.difficulty).toBe(4);
  expect(result.request.selection?.page).toBe(1);
  expect(result.request.selection?.context).toContain(
    "Attention is a mechanism",
  );
  expect(result.request.selection?.text.length).toBeGreaterThan(0);
  expect(result.answer.refused).toBe(false);
  expect(result.answer.sentences.map((s) => s.text).join(" ")).toMatch(
    /weights|weighting/,
  );
  await expect(
    page.getByText(/A translation was not returned by this provider/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/Offline provider: demonstrates evidence retrieval/).first(),
  ).toBeVisible();
  await page.getByLabel("Override answer language").selectOption("Marathi");
  const override = await assist(
    page,
    () => page.getByRole("button", { name: "Regenerate", exact: true }).click(),
    "override",
  );
  expect(override.request.language).toBe("Marathi");
  expect(override.request.selection).toEqual(result.request.selection);
  const simplify = await assist(
    page,
    () =>
      page
        .locator(".selected-passage")
        .getByRole("button", { name: "Simplify", exact: true })
        .click(),
    "simplify",
  );
  expect(simplify.request.action).toBe("simplify");
  expect(simplify.request.difficulty).toBe(4);
  expect(simplify.answer.translation).toBeFalsy();
});

test("grounded chat, exact source flash, retrieval debug, followups and refusal", async ({
  page,
  request,
  owned,
}) => {
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  const question = "What does attention weight in machine learning?";
  await page.getByLabel("Ask a follow-up question").fill(question);
  const result = await assist(
    page,
    () => page.getByLabel("Ask a follow-up question").press("Enter"),
    "chat",
  );
  expect(result.request.paperId).toBe(owned.paper.id);
  expect(result.answer.refused).toBe(false);
  expect(result.answer.sentences.map((s) => s.text).join(" ")).toMatch(
    /weights input representations|assigns different weights/,
  );
  expect(result.answer.debug.hits.length).toBeGreaterThan(0);
  expect(result.answer.debug.stages.join(" ")).toMatch(/rrf|reciprocal/i);
  expect(
    result.answer.debug.hits.some(
      (h) => Object.keys(h.ranks).length > 0 && h.chunk.rects.length > 0,
    ),
  ).toBe(true);
  const answer = page.locator(".chat-message.assistant").last();
  await expect(answer).toContainText(/weights|weighting/);
  await answer.locator(".debug-panel > summary").click();
  await expect(
    answer.getByRole("heading", { name: "Ranking stages" }),
  ).toBeVisible();
  await answer.locator(".debug-panel details > summary").first().click();
  await expect(answer.getByRole("table")).toBeVisible();
  await answer.locator(".source-citation").first().click();
  await expect(page.locator(".citation-flash").first()).toBeVisible();
  const citation = result.answer.sentences.flatMap((s) => s.citations)[0];
  expect(citation?.paperId).toBe(owned.paper.id);
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
    String(citation?.page),
  );
  await page
    .getByLabel("Ask a follow-up question")
    .fill("What is the current stock price of Apple?");
  const refusal = await assist(
    page,
    () => page.getByLabel("Ask a follow-up question").press("Enter"),
    "refusal",
  );
  expect(refusal.answer.refused).toBe(true);
  await expect(
    page
      .locator(".chat-message.assistant")
      .last()
      .getByText("The available paper evidence does not support this answer."),
  ).toBeVisible();
  await openPaper(page, owned.title);
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(
    page.locator(".chat-message.user").filter({ hasText: question }),
  ).toBeVisible();
  await expect(page.locator(".chat-message.user")).toHaveCount(2);
  const response = await request.get(`/api/chat?paperId=${owned.paper.id}`);
  expect((await response.json()).length).toBe(4);
});

test("glossary save edit delete and persisted flashcard grade", async ({
  page,
  request,
  owned,
}) => {
  await selectText(page);
  const response = await assist(
    page,
    () =>
      page
        .getByLabel("Selected text actions")
        .getByRole("button", { name: "Explain", exact: true })
        .click(),
    "glossary",
  );
  expect(response.answer.terms.length).toBeGreaterThan(0);
  const term = response.answer.terms[0];
  if (!term) throw new Error("No grounded term");
  await page
    .getByRole("button", { name: `Save ${term.term} to glossary`, exact: true })
    .click();
  await expect(
    page.getByText(`Saved “${term.term}” to your glossary.`, { exact: true }),
  ).toBeVisible();
  const entry = (await library(request)).glossary.find(
    (g) => g.paperId === owned.paper.id && g.term === term.term,
  );
  expect(entry?.context).toContain("Attention");
  await page.getByRole("tab", { name: "Glossary", exact: true }).click();
  const card = page.locator(".glossary-card").filter({ hasText: term.term });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit glossary term" });
  await dialog
    .getByRole("textbox", { name: "Definition", exact: true })
    .fill(
      "Attention assigns weights to input representations. Edited acceptance definition.",
    );
  await dialog.getByRole("button", { name: "Save term", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("tab", { name: "Review", exact: true }).click();
  await expect(page.locator(".flashcard-answer")).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal definition" }).click();
  await expect(page.locator(".flashcard-answer")).toContainText(
    "Edited acceptance definition",
  );
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await expect(
    page.getByText("You’re up to date", { exact: true }),
  ).toBeVisible();
  const graded = (await library(request)).glossary.find(
    (g) => g.id === entry?.id,
  );
  expect(graded?.repetitions).toBe(1);
  expect(graded?.interval).toBe(2);
  expect(graded?.dueAt).toBeGreaterThan(Date.now() + 86400000);
  await openPaper(page, owned.title);
  await page.getByRole("tab", { name: "Review", exact: true }).click();
  await expect(
    page.getByText("You’re up to date", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Glossary", exact: true }).click();
  await page.getByLabel("Search glossary").fill(term.term);
  await page
    .getByRole("button", {
      name: `Delete glossary term ${term.term}`,
      exact: true,
    })
    .click();
  await expect(page.locator(".glossary-card")).toHaveCount(0);
  expect(
    (await library(request)).glossary.some((g) => g.id === entry?.id),
  ).toBe(false);
});

test("citation hover and focus resolve real metadata and render cited PDF", async ({
  page,
  owned,
}) => {
  expect(owned.paper.references.some((r) => r.raw.includes("1706.03762"))).toBe(
    true,
  );
  const trigger = page
    .getByRole("button", { name: "Preview reference [1]", exact: true })
    .first();
  await trigger.hover();
  await expect(page.locator(".reference-preview h3")).toContainText(
    "Attention Is All You Need",
  );
  await expect(page.locator(".reference-preview")).toContainText(/Vaswani/);
  await expect(page.locator(".reference-preview")).toContainText("2017");
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expectRenderedCanvas(
    page.getByLabel("First page of cited paper", { exact: true }),
  );
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Escape");
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(page.locator(".reference-preview")).toBeVisible();
  await expect(
    page
      .locator(".reference-preview")
      .getByRole("link", { name: "Open source page" }),
  ).toHaveAttribute("href", /1706.03762/);
  await page.waitForLoadState("networkidle");
});

test("equation reference has a keyboard-accessible source preview", async ({
  page,
  owned,
}) => {
  expect(owned.paper.pages[0]?.text).toContain("Eq. (1)");
  expect(owned.paper.pages[0]?.text).toContain("softmax");
  const equation = page.getByRole("button", { name: /^Preview Eq/ }).first();
  await expect(equation).toBeVisible();
  await equation.focus();
  await expectRenderedCanvas(
    page.getByLabel("Thumbnail of page 1", { exact: true }),
  );
  await page
    .getByRole("button", { name: "Go to original · page 1", exact: true })
    .click();
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
    "1",
  );
});

test("command palette, shortcut conflict remap persistence, vim and typing isolation", async ({
  page,
  request,
  owned,
}) => {
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Search commands").fill("Last page");
  await palette.getByRole("button", { name: /Last page/ }).click();
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
    "2",
  );
  await page.getByLabel("Scrollable PDF pages").focus();
  await page.keyboard.press("g");
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
    "1",
  );
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Make the keyboard yours" });
  await expect(help).toBeVisible();
  await help.getByLabel("Search keyboard shortcuts").fill("Next page");
  await help.getByRole("button", { name: /Change/ }).click();
  const binding = help.getByLabel("Binding for Next page");
  await binding.press("g");
  await help.getByRole("button", { name: "Save", exact: true }).click();
  await expect(help.getByRole("alert")).toContainText("Already used by");
  await binding.press("Alt+n");
  await help.getByRole("button", { name: "Save", exact: true }).click();
  await expect(binding).toBeHidden();
  expect((await library(request)).settings.shortcuts.next).toBe("Alt+n");
  await page.keyboard.press("Escape");
  await page.getByLabel("Scrollable PDF pages").focus();
  await page.keyboard.press("Alt+n");
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
    "2",
  );
  await openPaper(page, owned.title);
  await page
    .getByRole("button", { name: "Keyboard shortcuts", exact: true })
    .click();
  await page.getByLabel("Search keyboard shortcuts").fill("Next page");
  await expect(page.locator(".shortcut-row")).toContainText("Alt+n");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.getByLabel("Ask a follow-up question").pressSequentially("gjkr?b");
  await expect(page.getByLabel("Ask a follow-up question")).toHaveValue(
    "gjkr?b",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
    "2",
  );
});

test("desktop tablet mobile controls, focus, reduced motion and screenshots", async ({
  page,
  owned,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("region", { name: `PDF reader: ${owned.title}` }),
    ).toBeVisible();
    await expect(page.locator(".textLayer span").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
      "1",
    );
    await page.screenshot({
      path: `artifacts/acceptance-${viewport.name}.png`,
    });
    await page
      .getByRole("button", { name: "Paper details", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Paper details" });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
      viewport.width,
    );
    await dialog.getByLabel("Title", { exact: true }).focus();
    await page.keyboard.press("Shift+Tab");
    expect(
      await dialog.evaluate((e) => e.contains(document.activeElement)),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/acceptance-${viewport.name}-modal.png`,
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Paper details", exact: true }),
    ).toBeFocused();
    if (viewport.name !== "desktop") {
      await page
        .getByRole("button", { name: "Learn & chat", exact: true })
        .click();
      await expect(
        page.getByRole("complementary", { name: "Learning workspace" }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Chat", exact: true }).click();
      await page
        .getByLabel("Ask a follow-up question")
        .fill("What does attention weight?");
      const result = await assist(
        page,
        () => page.getByLabel("Ask a follow-up question").press("Enter"),
        viewport.name,
      );
      expect(result.answer.refused).toBe(false);
      await page.screenshot({
        path: `artifacts/acceptance-${viewport.name}-chat.png`,
      });
      await page.getByRole("button", { name: "Read", exact: true }).click();
    }
  }
});

test("seeded glossary edit delete and persisted flashcard grade", async ({
  page,
  request,
  owned,
}) => {
  const term = {
    term: "attention",
    definition:
      "Attention is a mechanism that weights input representations according to relevance.",
  };
  const now = Date.now();
  const seed = await request.post("/api/glossary", {
    data: {
      id: crypto.randomUUID(),
      paperId: owned.paper.id,
      term: term.term,
      definition: term.definition,
      translation: "",
      language: "English",
      context: term.definition,
      dueAt: now,
      interval: 0,
      repetitions: 0,
      createdAt: now,
    },
  });
  expect(seed.ok()).toBe(true);
  const entry = (await library(request)).glossary.find(
    (g) => g.paperId === owned.paper.id && g.term === term.term,
  );
  expect(entry?.definition).toBe(term.definition);
  await openPaper(page, owned.title);
  await page.getByRole("tab", { name: "Glossary", exact: true }).click();
  const card = page.locator(".glossary-card").filter({ hasText: term.term });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit glossary term" });
  await dialog
    .getByRole("textbox", { name: "Definition", exact: true })
    .fill(
      "Attention assigns weights to input representations. Edited acceptance definition.",
    );
  await dialog.getByRole("button", { name: "Save term", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("tab", { name: "Review", exact: true }).click();
  await expect(page.locator(".flashcard-answer")).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal definition" }).click();
  await expect(page.locator(".flashcard-answer")).toContainText(
    "Edited acceptance definition",
  );
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await expect(
    page.getByText("You’re up to date", { exact: true }),
  ).toBeVisible();
  const graded = (await library(request)).glossary.find(
    (g) => g.id === entry?.id,
  );
  expect(graded?.repetitions).toBe(1);
  expect(graded?.interval).toBe(2);
  expect(graded?.dueAt).toBeGreaterThan(Date.now() + 86400000);
  await openPaper(page, owned.title);
  await page.getByRole("tab", { name: "Review", exact: true }).click();
  await expect(
    page.getByText("You’re up to date", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Glossary", exact: true }).click();
  await page.getByLabel("Search glossary").fill(term.term);
  await page
    .getByRole("button", {
      name: `Delete glossary term ${term.term}`,
      exact: true,
    })
    .click();
  await expect(page.locator(".glossary-card")).toHaveCount(0);
  expect(
    (await library(request)).glossary.some((g) => g.id === entry?.id),
  ).toBe(false);
});

test("drag selection Explain language override and difficulty requests", async ({
  page,
  owned,
}) => {
  expect(owned.paper.status).toBe("ready");
  await page.getByLabel("Default explanation language").selectOption("Telugu");
  await page.getByLabel("Explanation difficulty").fill("4");
  await selectText(page);
  const result = await assist(
    page,
    () =>
      page
        .getByLabel("Selected text actions")
        .getByRole("button", { name: "Explain", exact: true })
        .click(),
    "selection-drag",
  );
  expect(result.request.action).toBe("explain");
  expect(result.request.language).toBe("Telugu");
  expect(result.request.difficulty).toBe(4);
  expect(result.request.selection?.page).toBe(1);
  expect(result.request.selection?.context).toContain(
    "Attention is a mechanism",
  );
  expect(result.request.selection?.text.length).toBeGreaterThan(0);
  expect(result.answer.refused).toBe(false);
  expect(result.answer.sentences.map((s) => s.text).join(" ")).toMatch(
    /weights|weighting/,
  );
  await expect(
    page.getByText(/A translation was not returned by this provider/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/Offline provider: demonstrates evidence retrieval/).first(),
  ).toBeVisible();
  await page.getByLabel("Override answer language").selectOption("Marathi");
  const override = await assist(
    page,
    () => page.getByRole("button", { name: "Regenerate", exact: true }).click(),
    "override",
  );
  expect(override.request.language).toBe("Marathi");
  expect(override.request.selection).toEqual(result.request.selection);
  const simplify = await assist(
    page,
    () =>
      page
        .locator(".selected-passage")
        .getByRole("button", { name: "Simplify", exact: true })
        .click(),
    "simplify",
  );
  expect(simplify.request.action).toBe("simplify");
  expect(simplify.request.difficulty).toBe(4);
  expect(simplify.answer.translation).toBeFalsy();
});
