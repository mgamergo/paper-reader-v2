import type { Chunk, Paper, Rect } from "../domain";
import { pageLines } from "./chunks";
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
/** Narrow a chunk anchor to original lines overlapping its verbatim quotation. */
export function citationRects(
  chunk: Chunk,
  quote: string,
  papers: Paper[],
): Rect[] {
  const page = papers
    .find((p) => p.id === chunk.paperId)
    ?.pages.find((p) => p.number === chunk.page);
  if (!page) return chunk.rects;
  const lines = pageLines(page);
  const source = lines.map((l) => normalize(l.text)).join(" ");
  const chunkStart = source.indexOf(normalize(chunk.text));
  const quoteStart = normalize(chunk.text).indexOf(normalize(quote));
  if (chunkStart < 0 || quoteStart < 0) return chunk.rects;
  const start = chunkStart + quoteStart,
    end = start + normalize(quote).length;
  const rects: Rect[] = [];
  let offset = 0;
  for (const line of lines) {
    const length = normalize(line.text).length;
    if (offset < end && offset + length > start) rects.push(...line.rects);
    offset += length + 1;
  }
  return rects.length ? rects : chunk.rects;
}
