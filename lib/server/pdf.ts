import type { PaperPage, Paper, Reference } from "../domain";
import { parseReferences, extractDoi } from "./citations";
import { ImportError } from "./network";
export async function parsePdf(
  bytes: Uint8Array,
  filename: string,
): Promise<
  Pick<
    Paper,
    | "title"
    | "authors"
    | "abstract"
    | "venue"
    | "doi"
    | "year"
    | "pages"
    | "outline"
    | "references"
  >
> {
  if (bytes.length > 25 * 1024 * 1024)
    throw new ImportError("PDF files must be smaller than 25 MB.", 413);
  if (!Buffer.from(bytes.slice(0, 1024)).includes(Buffer.from("%PDF-")))
    throw new ImportError(
      "This file is not a PDF. Download the actual PDF and try again.",
    );
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    disableFontFace: true,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 300)
      throw new ImportError(
        "This reader currently supports papers up to 300 pages.",
        413,
      );
    const pages: PaperPage[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const spans: PaperPage["spans"] = [];
      let text = "";
      let lastY = NaN;
      let lastX = 0;
      let lastWidth = 0;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const x = item.transform[4] ?? 0;
        const y = viewport.height - (item.transform[5] ?? 0);
        const fontSize = Math.hypot(
          item.transform[2] ?? 0,
          item.transform[3] ?? item.height,
        );
        const height = Math.max(item.height, fontSize, 1);
        const rect = {
          x,
          y: y - height,
          width: Math.max(item.width, 1),
          height,
        };
        if (!Number.isNaN(lastY)) {
          if (
            Math.abs(y - lastY) > height * 0.55 ||
            x < lastX - lastWidth * 0.5
          )
            text += "\n";
          else if (x > lastX + lastWidth + 1) text += " ";
        }
        text += item.str;
        if (item.hasEOL) text += "\n";
        spans.push({ text: item.str, rect, fontSize });
        lastY = y;
        lastX = x;
        lastWidth = item.width;
      }
      pages.push({
        number,
        width: viewport.width,
        height: viewport.height,
        text: text.replace(/\n{3,}/g, "\n\n"),
        spans,
      });
      page.cleanup();
    }
    if (pages.reduce((sum, page) => sum + page.text.trim().length, 0) < 30)
      throw new ImportError(
        "This PDF has no selectable text. Scanned PDFs need OCR before import.",
      );
    const info = await pdf.getMetadata();
    const metadata = info.info;
    const infoTitle =
      typeof metadata === "object" &&
      metadata !== null &&
      "Title" in metadata &&
      typeof metadata.Title === "string"
        ? metadata.Title
        : "";
    const infoAuthor =
      typeof metadata === "object" &&
      metadata !== null &&
      "Author" in metadata &&
      typeof metadata.Author === "string"
        ? metadata.Author
        : "";
    const first = pages[0];
    const firstLines =
      first?.text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean) ?? [];
    const title =
      infoTitle &&
      infoTitle.length > 8 &&
      !/^(untitled|microsoft|latex|arxiv)/i.test(infoTitle)
        ? infoTitle
        : firstLines
            .filter(
              (line) =>
                line.length > 10 &&
                !/^arxiv|^submitted|^published|^preprint|^https?:/i.test(line),
            )
            .slice(0, 3)
            .join(" ")
            .slice(0, 300) || filename.replace(/\.pdf$/i, "");
    const all = pages.map((p) => p.text).join("\n");
    const abstractMatch = all.match(
      /(?:^|\n)\s*(?:abstract|a b s t r a c t)\s*[:.—-]?\s*([\s\S]{30,4000}?)(?=\n\s*(?:1[.\s]|introduction|keywords|index terms)\b)/i,
    );
    const doi = extractDoi(all.slice(0, 12000));
    const yearText = all.slice(0, 5000).match(/\b(?:19|20)\d{2}\b/)?.[0];
    const outline: Paper["outline"] = [];
    const rawOutline = await pdf.getOutline();
    if (rawOutline) {
      const visit = async (
        items: typeof rawOutline,
        depth: number,
      ): Promise<void> => {
        for (const item of items ?? []) {
          let pageNumber = 1;
          let dest: unknown = item.dest;
          if (typeof dest === "string") dest = await pdf.getDestination(dest);
          if (Array.isArray(dest) && dest[0]) {
            try {
              const ref = dest[0];
              if (typeof ref === "number") pageNumber = ref + 1;
              else if (
                typeof ref === "object" &&
                ref !== null &&
                "num" in ref &&
                "gen" in ref &&
                typeof ref.num === "number" &&
                typeof ref.gen === "number"
              )
                pageNumber =
                  (await pdf.getPageIndex({ num: ref.num, gen: ref.gen })) + 1;
            } catch {
              pageNumber = 1;
            }
          }
          outline.push({ title: item.title, page: pageNumber, depth });
          if (item.items?.length) await visit(item.items, depth + 1);
        }
      };
      await visit(rawOutline, 0);
    }
    if (!outline.length)
      for (const page of pages) {
        for (const line of page.text.split("\n")) {
          const title = line.trim();
          if (
            /^(?:\d+(?:\.\d+)*\.?\s+[A-Z][\p{L}\s,:()-]{2,85}|Abstract|References|Bibliography|Appendix\s+[A-Z].*)$/u.test(
              title,
            )
          )
            outline.push({
              title,
              page: page.number,
              depth:
                (title.match(/^\d+(\.\d+)*/)?.[0].split(".").length ?? 1) - 1,
            });
        }
      }
    const references: Reference[] = parseReferences(pages);
    return {
      title,
      authors: infoAuthor
        ? infoAuthor
            .split(/;|\s+and\s+/)
            .map((a) => a.trim())
            .filter(Boolean)
        : [],
      abstract: abstractMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "",
      venue: "",
      ...(doi ? { doi } : {}),
      ...(yearText ? { year: Number(yearText) } : {}),
      pages,
      outline,
      references,
    };
  } catch (error) {
    if (error instanceof ImportError) throw error;
    const message =
      error instanceof Error ? error.message : "Unknown PDF error";
    if (/password/i.test(message))
      throw new ImportError(
        "This PDF is password protected. Upload an unlocked copy.",
      );
    throw new ImportError(
      `The PDF could not be read: ${message.slice(0, 180)}`,
    );
  } finally {
    await task.destroy();
  }
}
