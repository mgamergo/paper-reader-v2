# Integrate and verify the frontend

Run the commands below inside `/home/boxes/repos/paper-reader-v2` through `bash /data/workspace/reader-v2-box` with a quoted heredoc. Reuse the parent's services and avoid another browser or test worker. The parent owns the services on ports 3000, 3210 and 3211.

## Prepare the PDF worker

1. Confirm that the installed pdf.js version matches the served worker.
2. Copy the worker if the parent has not already done so.

```bash
mkdir -p public
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
```

Keep the worker at `/pdf.worker.min.mjs`. The reader assigns this exact URL before loading a document.

## Run the frontend checks

```bash
bunx prettier --check app/page.tsx app/layout.tsx app/globals.css components hooks lib/client.ts lib/shortcuts.ts lib/export.ts tests/unit/shortcuts.test.ts tests/unit/export.test.ts docs/ui-implementation.md docs/ui-integration.md
bunx eslint app/page.tsx app/layout.tsx components hooks lib/client.ts lib/shortcuts.ts lib/export.ts tests/unit/shortcuts.test.ts tests/unit/export.test.ts --max-warnings 0
bun test tests/unit/shortcuts.test.ts tests/unit/export.test.ts
bun run typecheck
```

If TypeScript reports missing `bun:test` or `Bun` despite the installed Bun types, run `bunx tsc --noEmit --types bun,node`. The parent can make the type list explicit in the shared tsconfig. Do not add another dependency solely to fix implicit type discovery.

Run the complete lint, formatting, tests and production build after the parent integrates shared changes. The scoped command excludes backend routes and sign-in code outside the implementation ownership.

## Verify the library and import buttons

1. Open the production build at 1280×720 and 1440×900.
2. Assert that **Add paper** and **Import paper** have readable, unclipped text and an accessible name.
3. Open the import dialog from each button.
4. Upload a real PDF and observe byte progress followed by the indexing state.
5. Import `1706.03762` and confirm that the library opens the server-returned paper.
6. Search by author, sort by year, create a collection, edit membership, filter by tag, and delete the collection.
7. Reload and assert that metadata changes persist.

## Verify the PDF and learning flows

1. Select real text in a rendered `.textLayer` and assert that `window.getSelection().toString()` contains the source text.
2. Explain the selection and inspect the outgoing request for the page and surrounding paragraph.
3. Highlight the selection, change zoom, rotate, and assert that the overlay remains aligned with the glyphs.
4. Reload and assert that the annotation and current page persist.
5. Search a real word, assert visible `.search-mark` rectangles, and use Enter and Shift+Enter.
6. Change single-page mode, fit width, fit page and page input.
7. Open the outline and a real thumbnail, then assert the destination page.
8. Compare a second paper and verify independent page and zoom controls.
9. Hover and keyboard-focus numeric, author-year and superscript reference hotspots. Check unresolved states and numeric ranges.
10. Open a reference with `pdfUrl` and assert a successful request to `/api/reference-preview`, then a rendered canvas.
11. Open a figure or table preview and jump to the original page.
12. Inspect provider labels, missing-translation states and refusals. Do not treat the offline provider as proof of translation quality.
13. Save a glossary term, reveal its flashcard, grade recall, reload, and assert the saved review schedule.
14. Send document and collection questions, reload history, and follow a per-sentence citation to its exact source rectangles.
15. Expand retrieval details and inspect queries, HyDE, scores, ranks and stages.
16. Export notes as Markdown and metadata as BibTeX. Inspect the downloaded content.

## Verify keyboard and responsive behavior

1. Open the command palette with Mod+k and the shortcut dialog with ?.
2. Remap a command, reject a conflicting binding, reload, and assert persistence.
3. Type normal shortcut letters inside library search, metadata inputs and chat. Assert that reading commands do not run.
4. Verify global commands, PDF-search Enter exceptions, Escape dismissal and returned focus.
5. Check keyboard access to citation previews, their close buttons and action buttons.
6. At 768×1024 and 390×844, assert that dialogs, toolbars and import buttons stay within the viewport.
7. On mobile, switch between **Read** and **Learn & chat** and complete an explanation flow.
8. Enable reduced motion and assert usable controls without required animation.
9. Capture and inspect desktop, tablet and mobile screenshots.

Attach console, uncaught-page, failed-request and HTTP-error diagnostics before navigation. Keep expected abort exclusions narrow. Close test-owned browser resources afterward. Parent-owned Next and Convex services stay under parent control.

## Reproduce short demonstrations

Record only after the associated flow passes assertions.

- Select a technical term, explain it with the paper context, and save its glossary card.
- Follow a sentence citation to the flashing source passage and return to the explanation.
- Hover a cited reference, preview the actual PDF and add it to the library.
- Reveal a glossary flashcard, grade recall and show the persisted next-review state.

Keep each clip focused on one complete flow. Do not describe offline text as a successful translation.
