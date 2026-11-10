import { format } from "prettier";
import { z } from "zod";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { paperSchema, type PaperPage } from "../lib/domain";
import { mkdir } from "node:fs/promises";

const sources = [
  {
    id: "2402.00838v4",
    title: "OLMo: Accelerating the Science of Language Models",
    pages: 6,
  },
  {
    id: "2101.00027v1",
    title: "The Pile: An 800GB Dataset of Diverse Text for Language Modeling",
    pages: 6,
  },
];
async function download(url: string, maxBytes: number): Promise<Uint8Array> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    redirect: "error",
  });
  if (!response.ok || !response.body)
    throw new Error(`Download failed: ${url} HTTP ${response.status}`);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Fixture download too large");
      }
      parts.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
const spanInput = z.object({
  str: z.string(),
  transform: z.array(z.number()).length(6),
  width: z.number(),
  height: z.number(),
});
await mkdir("tests/fixtures/rag", { recursive: true });
for (const source of sources) {
  const absUrl = `https://arxiv.org/abs/${source.id}`;
  const html = new TextDecoder().decode(await download(absUrl, 2_000_000));
  const license = html.match(
    /https?:\/\/creativecommons\.org\/licenses\/[a-z-]+\/[\d.]+\//,
  )?.[0];
  if (!license || !/\/by\/4\.0\//.test(license))
    throw new Error(
      `Expected verified CC BY 4.0 license for ${source.id}; got ${license}`,
    );
  const authors = [
    ...html.matchAll(/<meta name="citation_author" content="([^"]+)"/g),
  ]
    .map((m) => m[1])
    .filter((s): s is string => typeof s === "string");
  if (!authors.length) throw new Error("Missing author attribution");
  const pdfUrl = `https://arxiv.org/pdf/${source.id}`;
  const bytes = await download(pdfUrl, 12_000_000);
  const pdfSha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const loading = getDocument({ data: bytes, useSystemFonts: true });
  const document = await loading.promise;
  const pages: PaperPage[] = [];
  try {
    for (
      let number = 1;
      number <= Math.min(document.numPages, source.pages);
      number++
    ) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const spans = content.items.flatMap((item) => {
        const parsed = spanInput.safeParse(item);
        if (!parsed.success || !parsed.data.str.trim()) return [];
        const value = parsed.data;
        const [x, y] = viewport.convertToViewportPoint(
          value.transform[4] ?? 0,
          value.transform[5] ?? 0,
        );
        const height = Math.max(1, value.height);
        return [
          {
            text: value.str,
            fontSize: height,
            rect: {
              x: x ?? 0,
              y: (y ?? 0) - height,
              width: Math.max(1, value.width),
              height,
            },
          },
        ];
      });
      pages.push({
        number,
        width: viewport.width,
        height: viewport.height,
        text: spans.map((s) => s.text).join(" "),
        spans,
      });
      page.cleanup();
    }
  } finally {
    await loading.destroy();
  }
  const paper = paperSchema.parse({
    id: source.id,
    title: source.title,
    authors,
    abstract: "",
    venue: "arXiv",
    arxivId: source.id,
    sourceUrl: absUrl,
    pdfUrl,
    pages,
    outline: [],
    references: [],
    tags: ["real-arxiv-evaluation-excerpt"],
    collectionIds: ["rag-eval"],
    progress: 0,
    currentPage: 1,
    createdAt: 0,
    status: "ready",
  });
  await Bun.write(
    `tests/fixtures/rag/${source.id}.json`,
    await format(
      JSON.stringify(
        {
          provenance: {
            source: absUrl,
            pdfUrl,
            license,
            authors,
            pdfSha256,
            downloadedAt: new Date().toISOString(),
            pages: pages.map((p) => p.number),
            extraction:
              "pdfjs-dist text items; coordinates approximate glyph boxes; first six original pages only; PDF not retained",
          },
          paper,
        },
        null,
        2,
      ),
      { parser: "json" },
    ),
  );
  console.log(
    JSON.stringify({ id: source.id, pages: pages.length, pdfSha256, license }),
  );
}
