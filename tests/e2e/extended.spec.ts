import {
  test,
  expect,
  library,
  annotations,
  selectText,
  assist,
  openPaper,
} from "./acceptance-support";
import { PDFDocument } from "pdf-lib";
import { paperSchema, answerSchema } from "../../lib/domain";
import {
  citationVariantsPdf,
  importBytes,
  openImport,
  submitImport,
  uniquePdf,
} from "./extended-support";

test("DOI and public PDF URL imports resolve actual cached bytes and deduplicate", async ({
  page,
  request,
}) => {
  const before = await library(request);
  const created = new Set<string>();
  try {
    await page.goto("/");
    for (const source of [
      "10.48550/arXiv.1706.03762",
      "https://arxiv.org/pdf/1706.03762",
    ]) {
      const dialog = await openImport(page);
      await dialog.getByLabel("DOI, arXiv ID or public URL").fill(source);
      const response = await submitImport(page);
      expect(response.ok(), await response.text()).toBe(true);
      const paper = paperSchema.parse(await response.json());
      if (!before.papers.some((p) => p.id === paper.id)) created.add(paper.id);
      expect(paper.title).toBe("Attention Is All You Need");
      expect(paper.pages).toHaveLength(15);
      expect(paper.authors).toContain("Ashish Vaswani");
      const pdf = await request.get(`/api/papers/${paper.id}/pdf`);
      expect(pdf.ok()).toBe(true);
      expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
      await expect(dialog).toBeHidden();
      await expect(page.locator(".textLayer")).toContainText([
        "Attention Is All You Need",
      ]);
    }
    const after = await library(request);
    expect(
      after.papers.filter((p) => p.title === "Attention Is All You Need"),
    ).toHaveLength(1);
    expect(created.size).toBeLessThanOrEqual(1);
  } finally {
    for (const id of created)
      expect((await request.delete(`/api/papers/${id}`)).ok()).toBe(true);
    expect(
      (await request.patch("/api/settings", { data: before.settings })).ok(),
    ).toBe(true);
  }
});

test("dragging an actual PDF onto the import zone creates a readable indexed paper", async ({
  page,
  request,
}) => {
  const title = `Extended drop ${Date.now()}`;
  let id = "";
  try {
    await page.goto("/");
    const dialog = await openImport(page);
    const bytes = await uniquePdf(title);
    const transfer = await page.evaluateHandle(
      ({ name, base64 }) => {
        const data = new DataTransfer();
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        data.items.add(new File([bytes], name, { type: "application/pdf" }));
        return data;
      },
      { name: `${title}.pdf`, base64: bytes.toString("base64") },
    );
    try {
      await dialog
        .locator(".drop-zone")
        .dispatchEvent("drop", { dataTransfer: transfer });
    } finally {
      await transfer.dispose();
    }
    await expect(dialog.locator(".drop-zone strong")).toHaveText(
      `${title}.pdf`,
    );
    const response = await submitImport(page);
    expect(response.ok(), await response.text()).toBe(true);
    const paper = paperSchema.parse(await response.json());
    id = paper.id;
    expect(paper.status).toBe("ready");
    expect(paper.pages[0]?.text).toContain("Attention is a mechanism");
    await expect(dialog).toBeHidden();
    await expect(page.locator(".textLayer")).toContainText([
      "Attention is a mechanism",
    ]);
    expect((await library(request)).papers.some((p) => p.id === id)).toBe(true);
  } finally {
    if (id) expect((await request.delete(`/api/papers/${id}`)).ok()).toBe(true);
  }
});

test("import rejects invalid extensions and oversized files before uploading", async ({
  page,
  request,
}) => {
  const before = await library(request);
  let imports = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/import") imports++;
  });
  await page.goto("/");
  const dialog = await openImport(page);
  await dialog.getByLabel("Upload PDF").setInputFiles({
    name: "unsupported.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a PDF"),
  });
  await expect(dialog.getByRole("alert")).toContainText("Choose a PDF file.");
  await expect(
    dialog.getByRole("button", { name: "Import paper", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Upload PDF").setInputFiles({
    name: "oversized.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
  });
  await expect(dialog.getByRole("alert")).toContainText("smaller than 25 MB");
  await expect(
    dialog.getByRole("button", { name: "Import paper", exact: true }),
  ).toBeDisabled();
  expect(imports).toBe(0);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  expect((await library(request)).papers.map((p) => p.id).sort()).toEqual(
    before.papers.map((p) => p.id).sort(),
  );
});

test("invalid source and image-only PDF errors stay actionable and retry accepts a valid PDF", async ({
  page,
  request,
  diagnostics,
}) => {
  const title = `Extended retry ${Date.now()}`;
  let id = "";
  diagnostics.allowHttp(/\/api\/import$/, 400);
  try {
    await page.goto("/");
    const dialog = await openImport(page);
    await dialog.getByLabel("DOI, arXiv ID or public URL").fill("not-a-source");
    const badSource = await submitImport(page);
    expect(badSource.status()).toBe(400);
    await expect(dialog.getByRole("alert")).toContainText("valid public HTTP");
    const blank = await PDFDocument.create();
    blank.addPage();
    await dialog.getByLabel("Upload PDF").setInputFiles({
      name: "scan-without-text.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await blank.save()),
    });
    const noText = await submitImport(page);
    expect(noText.status()).toBe(400);
    await expect(dialog.getByRole("alert")).toContainText(/text|scann|OCR/i);
    await dialog.getByLabel("Upload PDF").setInputFiles({
      name: `${title}.pdf`,
      mimeType: "application/pdf",
      buffer: await uniquePdf(title),
    });
    const recovered = await submitImport(page);
    expect(recovered.ok(), await recovered.text()).toBe(true);
    id = paperSchema.parse(await recovered.json()).id;
    await expect(dialog).toBeHidden();
    await expect(page.locator(".textLayer")).toContainText([
      "Attention is a mechanism",
    ]);
  } finally {
    if (id) expect((await request.delete(`/api/papers/${id}`)).ok()).toBe(true);
  }
});

test("citation groups ranges author-year superscripts and unresolved entries retain their identities", async ({
  page,
  request,
}) => {
  const title = `Extended citations ${Date.now()}`;
  let id = "";
  try {
    await page.goto("/");
    const paper = await importBytes(
      page,
      title,
      await citationVariantsPdf(title),
    );
    id = paper.id;
    expect(paper.references).toHaveLength(2);
    for (const label of ["[1, 2]", "[1-2]"]) {
      const trigger = page
        .getByRole("button", {
          name: `Preview reference ${label}`,
          exact: true,
        })
        .first();
      await trigger.focus();
      const card = page.locator(".reference-preview");
      const choice = card.getByLabel("Choose a work in this citation");
      await expect(choice.locator("option")).toHaveCount(2);
      await trigger.press("ArrowDown");
      await choice.selectOption("ref-2");
      await expect(card.getByRole("heading")).toHaveText(
        "Contextual citation example",
      );
      await expect(card).toContainText("2020");
      await expect(
        card.getByText("Resolving metadata…", { exact: true }),
      ).toBeHidden();
      await page.waitForLoadState("networkidle");
      await page.keyboard.press("Escape");
    }
    for (const label of ["Smith (2020)", "2"]) {
      const trigger = page
        .getByRole("button", {
          name: `Preview reference ${label}`,
          exact: true,
        })
        .first();
      await trigger.focus();
      await expect(page.locator(".reference-preview h3")).toHaveText(
        "Contextual citation example",
      );
      await expect(
        page.getByText("Resolving metadata…", { exact: true }),
      ).toBeHidden();
      await page.waitForLoadState("networkidle");
      await page.keyboard.press("Escape");
    }
    await page
      .getByRole("button", { name: "Preview reference [99]", exact: true })
      .focus();
    const unresolved = page.locator(".reference-preview");
    await expect(unresolved.getByRole("heading")).toHaveText(
      "Unresolved citation",
    );
    await expect(unresolved).toContainText("could not be linked");
    await expect(
      unresolved.getByRole("button", { name: "Add to library", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
  } finally {
    if (id) expect((await request.delete(`/api/papers/${id}`)).ok()).toBe(true);
  }
});

test("highlight rectangles remain aligned with selected glyphs after zoom and rotation", async ({
  page,
  request,
  owned,
}) => {
  await selectText(page);
  await page
    .getByLabel("Selected text actions")
    .getByRole("button", { name: "Highlight", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Save annotation" })
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Save annotation" }),
  ).toBeHidden();
  const records = await annotations(request, owned.paper.id);
  expect(records).toHaveLength(1);
  expect(records[0]?.rects.length).toBeGreaterThan(0);
  await page.getByLabel("Zoom and fit").selectOption("1.25");
  for (const rotate of [false, true]) {
    if (rotate)
      await page
        .getByRole("button", { name: "Rotate clockwise", exact: true })
        .click();
    await expect(
      page.locator('.pdf-page[data-page-number="1"] .annotation-mark').first(),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.locator('.pdf-page[data-page-number="1"]').evaluate((element) => {
          const span = Array.from(
            element.querySelectorAll(".textLayer span"),
          ).find((span) =>
            span.textContent?.includes("Attention is a mechanism"),
          );
          const marks = Array.from(
            element.querySelectorAll(".annotation-mark"),
          );
          if (!span || !marks.length) return 0;
          const glyph = span.getBoundingClientRect();
          const marker = marks[0]?.getBoundingClientRect();
          if (!marker || !glyph.width || !glyph.height) return 0;
          const area =
            Math.max(
              0,
              Math.min(glyph.right, marker.right) -
                Math.max(glyph.left, marker.left),
            ) *
            Math.max(
              0,
              Math.min(glyph.bottom, marker.bottom) -
                Math.max(glyph.top, marker.top),
            );
          return area / (marker.width * marker.height);
        }),
      )
      .toBeGreaterThan(0.9);
  }
});

test("assistant actions keep selected paper context and support copy and save-to-note", async ({
  page,
  request,
  context,
  owned,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await selectText(page);
  for (const [label, action] of [
    ["Define", "define"],
    ["Summarize section", "summarize"],
    ["Translate", "translate"],
    ["Find related papers", "related"],
    ["Explain equation", "equation"],
    ["Explain figure", "figure"],
  ]) {
    const result = await assist(
      page,
      () =>
        page
          .locator(".selected-passage")
          .getByRole("button", { name: label, exact: true })
          .click(),
      `extended-${action}`,
    );
    expect(result.request.action).toBe(action);
    expect(result.request.selection?.rects?.length).toBeGreaterThan(0);
    expect(result.request.paperId).toBe(owned.paper.id);
    expect(result.request.selection?.context).toContain(
      "Attention is a mechanism",
    );
    expect(result.answer.provider).toMatch(/offline|mock/i);
    if (action === "related") {
      expect(result.answer.refused).toBe(false);
      expect(
        result.answer.sentences.map((sentence) => sentence.text).join(" "),
      ).toContain("Attention Is All You Need");
      expect(
        result.answer.debug.hits.every(
          (hit) => hit.chunk.kind === "references",
        ),
      ).toBe(true);
      expect(result.answer.debug.stages).toContain(
        "related-bibliography-scope",
      );
    }
    if (action === "summarize") {
      expect(result.answer.debug.filters.section).toBe("Abstract");
      expect(
        result.answer.debug.hits.every((hit) =>
          hit.chunk.sectionPath.includes("Abstract"),
        ),
      ).toBe(true);
    }

    for (const sentence of result.answer.sentences) {
      expect(sentence.citations.length).toBeGreaterThan(0);
      expect(
        sentence.citations.every(
          (c) =>
            c.paperId === owned.paper.id &&
            owned.paper.pages.some(
              (p) =>
                p.number === c.page &&
                p.text
                  .replace(/\s+/g, " ")
                  .includes(c.quote.replace(/\s+/g, " ")),
            ),
        ),
      ).toBe(true);
    }
    await expect(page.locator(".answer .provider-notice")).toContainText(
      "Language quality",
    );
    await expect(page.locator(".answer .translation")).toContainText(
      "No translated text has been generated",
    );
  }
  const explanation = await assist(
    page,
    () =>
      page
        .locator(".selected-passage")
        .getByRole("button", { name: "Explain", exact: true })
        .click(),
    "extended-save-explanation",
  );
  expect(explanation.answer.refused).toBe(false);
  await page
    .getByRole("button", { name: "Copy explanation", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    explanation.answer.sentences.map((s) => s.text).join("\n"),
  );
  await page
    .getByRole("button", { name: "Save explanation to notes", exact: true })
    .click();
  await expect(
    page.getByText("Explanation saved to your notes.", { exact: true }),
  ).toBeVisible();
  const notes = await annotations(request, owned.paper.id);
  const saved = notes.find((note) => note.tags.includes("explanation"));
  expect(saved?.kind).toBe("note");
  expect(saved?.comment).toContain(
    explanation.answer.sentences[0]?.text ?? "missing answer",
  );
  expect(saved?.rects.length).toBeGreaterThan(0);
  await page.getByRole("tab", { name: /^Notes/ }).click();
  await expect(page.locator(".annotation-card")).toContainText([
    explanation.answer.sentences[0]?.text ?? "missing answer",
  ]);
});

test("section and passage-type filters constrain actual retrieved evidence", async ({
  page,
  owned,
}) => {
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.locator(".retrieval-controls summary").click();
  await page.getByLabel("Section", { exact: true }).fill("Introduction");
  await page.getByLabel("Passage type", { exact: true }).selectOption("text");
  await page.getByLabel("Include cited papers already in my library").check();
  await page
    .getByLabel("Ask a follow-up question")
    .fill(
      "How does attention assign different weights to input representations?",
    );
  const result = await assist(
    page,
    () => page.getByLabel("Ask a follow-up question").press("Enter"),
    "extended-filters",
  );
  expect(result.request.filters).toEqual({
    section: "Introduction",
    kind: "text",
    expandCitations: true,
  });
  expect(result.answer.debug.hits.length).toBeGreaterThan(0);
  expect(
    result.answer.debug.hits.every(
      (hit) =>
        hit.chunk.kind === "text" &&
        hit.chunk.sectionPath.some((section) => /Introduction/i.test(section)),
    ),
  ).toBe(true);
  await page
    .locator(".chat-message.assistant .debug-panel summary")
    .first()
    .click();
  await expect(
    page.locator(".chat-message.assistant .debug-panel pre"),
  ).toContainText("Introduction");
  expect(
    result.answer.debug.hits.some(
      (hit) => hit.chunk.paperId === owned.paper.id,
    ),
  ).toBe(true);
});

test("reader shortcut commands change navigation tools and learning tabs without stealing typing", async ({
  page,
  owned,
}) => {
  const scroll = page.getByLabel("Scrollable PDF pages");
  const press = async (key: string) => {
    await scroll.focus();
    await page.keyboard.press(key);
  };
  await press("PageDown");
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
    "2",
  );
  await press("PageUp");
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
    "1",
  );
  await press("o");
  await expect(
    page.getByRole("complementary", { name: "outline", exact: true }),
  ).toBeVisible();
  await press("o");
  await expect(
    page.getByRole("complementary", { name: "outline", exact: true }),
  ).toBeHidden();
  await press("t");
  await expect(
    page.getByRole("complementary", { name: "thumbnails", exact: true }),
  ).toBeVisible();
  await press("t");
  await expect(
    page.getByRole("complementary", { name: "thumbnails", exact: true }),
  ).toBeHidden();
  await press("f");
  await expect(page.getByLabel("Zoom and fit")).toHaveValue("page");
  await press("w");
  await expect(page.getByLabel("Zoom and fit")).toHaveValue("width");
  await press("0");
  await expect(page.getByLabel("Zoom and fit")).toHaveValue("1");
  await press("+");
  await expect(page.getByLabel("Zoom and fit")).toHaveValue("1.15");
  await press("-");
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Zoom and fit").inputValue()),
    )
    .toBeCloseTo(1, 8);
  await press("p");
  await expect(
    page.getByRole("button", { name: "Single page", exact: true }),
  ).toBeVisible();
  await press("p");
  await expect(
    page.getByRole("button", { name: "Continuous", exact: true }),
  ).toBeVisible();
  for (const [key, label] of [
    ["l", "Glossary"],
    ["v", "Review"],
    ["c", "Chat"],
  ]) {
    await press(key ?? "");
    await expect(
      page.getByRole("tab", { name: label, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.getByLabel("Ask a follow-up question")).toBeFocused();
  await page
    .getByLabel("Ask a follow-up question")
    .fill("jkoctfv are literal text here");
  await expect(
    page.getByRole("tab", { name: "Chat", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue(
    "1",
  );
  await page.keyboard.press("Control+f");
  await expect(page.getByLabel("Search PDF text")).toBeFocused();
  await page.keyboard.press("Escape");
  await press("Control+o");
  await expect(
    page.getByRole("dialog", { name: "Add a paper", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Add a paper", exact: true }),
  ).toBeHidden();
  await press("Shift+f");
  await expect(page.locator(".workspace")).toHaveClass(/focus-mode/);
  await press("Shift+f");
  await expect(page.locator(".workspace")).not.toHaveClass(/focus-mode/);
  await expect(
    page.getByRole("region", {
      name: `PDF reader: ${owned.title}`,
      exact: true,
    }),
  ).toBeVisible();
});

test("manual Hindi UI protocol fixture pairs citations preserves answer language and saves translated definitions", async ({
  page,
  request,
  owned,
}) => {
  const native =
    "Attention एक ऐसी प्रणाली है जो प्रासंगिकता के अनुसार इनपुट निरूपणों को महत्व देती है।";
  await page.route(
    "**/api/assist",
    async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      const actual = answerSchema.parse(await response.json());
      const source = actual.sentences.find((sentence) =>
        sentence.text.startsWith("Attention is a mechanism"),
      );
      if (!source)
        throw new Error(
          "Manual UI fixture requires the exact authored attention definition from the real RAG response",
        );
      const fixture = answerSchema.parse({
        ...actual,
        provider:
          "offline UI protocol fixture — manual Hindi, not generated model output",
        language: "Hindi",
        sentences: [{ ...source, translation: native }],
        translation: native,
        terms: [
          {
            term: "Attention",
            definition: source.text,
            translation: native,
            citations: source.citations,
          },
        ],
      });
      await route.fulfill({ response, json: fixture });
    },
    { times: 1 },
  );
  await selectText(page);
  const result = await assist(
    page,
    () =>
      page
        .getByLabel("Selected text actions")
        .getByRole("button", { name: "Explain", exact: true })
        .click(),
    "extended-native-ui-protocol",
  );
  expect(result.answer.provider).toContain("UI protocol fixture");
  const translation = page.locator(".answer .translation");
  await expect(translation.locator("p[lang=hi]")).toContainText(native);
  await expect(
    translation.getByRole("button", {
      name: /Read source for Hindi sentence on page 1/,
    }),
  ).toHaveCount(1);
  await page.screenshot({
    path: "artifacts/acceptance-native-ui-protocol.png",
  });
  await page.getByLabel("Default explanation language").selectOption("Telugu");
  await expect(translation.getByRole("heading")).toContainText("Hindi");
  await translation
    .getByRole("button", { name: /Read source for Hindi sentence on page 1/ })
    .click();
  await expect(
    page.locator('.pdf-page[data-page-number="1"] .citation-flash').first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save Attention to glossary", exact: true })
    .click();
  await expect(
    page.getByText("Saved “Attention” to your glossary.", { exact: true }),
  ).toBeVisible();
  const saved = (await library(request)).glossary.find(
    (term) => term.paperId === owned.paper.id && term.term === "Attention",
  );
  expect(saved?.language).toBe("Hindi");
  expect(saved?.translation).toBe(native);
  expect(saved?.context).toContain("Attention is a mechanism");
  await openPaper(page, owned.title);
  await page.getByRole("tab", { name: "Glossary", exact: true }).click();
  await expect(
    page.locator(".glossary-card").filter({ hasText: "Attention" }),
  ).toContainText(native);
});

test("mobile and tablet import dialogs keep form controls reachable and keyboard focus inside", async ({
  page,
}) => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const opener = page.getByRole("button", {
      name: "Import paper",
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole("dialog", {
      name: "Add a paper",
      exact: true,
    });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? Infinity)).toBeLessThanOrEqual(
      viewport.width,
    );
    expect(bounds?.y).toBeGreaterThanOrEqual(0);
    expect((bounds?.y ?? 0) + (bounds?.height ?? Infinity)).toBeLessThanOrEqual(
      viewport.height,
    );
    await dialog.getByLabel("DOI, arXiv ID or public URL").fill("1706.03762");
    await dialog
      .getByRole("button", { name: "Import paper", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      dialog.getByRole("button", { name: "Import paper", exact: true }),
    ).toBeInViewport();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  }
});

test("remapped dismissal closes modals while physical Escape remains an available fallback", async ({
  page,
  request,
  owned,
}) => {
  await page
    .getByRole("button", { name: "Keyboard shortcuts", exact: true })
    .click();
  const help = page.getByRole("dialog", {
    name: "Make the keyboard yours",
    exact: true,
  });
  await help.getByLabel("Search keyboard shortcuts").fill("Close popup");
  await help.getByRole("button", { name: /Change/ }).click();
  const binding = help.getByLabel("Binding for Close popup / palette / drawer");
  await binding.press("Alt+q");
  await help.getByRole("button", { name: "Save", exact: true }).click();
  await expect(binding).toBeHidden();
  expect((await library(request)).settings.shortcuts.escape).toBe("Alt+q");
  await page.keyboard.press("Alt+q");
  await expect(help).toBeHidden();
  await page.getByRole("button", { name: "Add paper", exact: true }).click();
  const importer = page.getByRole("dialog", {
    name: "Add a paper",
    exact: true,
  });
  await expect(importer).toBeVisible();
  await page.keyboard.press("Alt+q");
  await expect(importer).toBeHidden();
  await page
    .getByRole("button", { name: "Paper details", exact: true })
    .click();
  const details = page.getByRole("dialog", {
    name: "Paper details",
    exact: true,
  });
  await expect(details).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await openPaper(page, owned.title);
  await page
    .getByRole("button", { name: "Keyboard shortcuts", exact: true })
    .click();
  await help.getByLabel("Search keyboard shortcuts").fill("Close popup");
  await expect(help.locator(".shortcut-row")).toContainText("Alt+q");
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
});

test("local authorization validates incoming authority through the running Next server", async ({
  request,
}) => {
  const valid = await request.get("/api/library");
  expect(valid.status()).toBe(200);
  const invalid = await request.get("/api/library", {
    headers: { host: "review.invalid:3000" },
  });
  expect(invalid.status()).toBe(403);
  expect(await invalid.json()).toEqual({
    error:
      "Local workspace mode is restricted to loopback. Configure Clerk for hosted access.",
  });
});
