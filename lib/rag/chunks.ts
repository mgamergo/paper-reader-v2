import type { Chunk, Paper, PaperPage, Rect } from "../domain";
import { RagError } from "./contracts";
type Span = PaperPage["spans"][number];
interface Line {
  text: string;
  rects: Rect[];
  font: number;
  y: number;
}
function mergeLines(spans: Span[]): Line[] {
  // Establish rows from normal-sized glyphs before attaching superscripts/subscripts.
  const ordered = [...spans].sort(
    (a, b) =>
      b.fontSize - a.fontSize || a.rect.y - b.rect.y || a.rect.x - b.rect.x,
  );
  const rows: Span[][] = [];
  for (const span of ordered) {
    const baseline = span.rect.y + span.rect.height;
    const closest = rows
      .map((row) => ({ row, anchor: row[0] }))
      .filter(
        (item): item is { row: Span[]; anchor: Span } =>
          item.anchor !== undefined,
      )
      .map((item) => ({
        ...item,
        distance: Math.abs(
          item.anchor.rect.y + item.anchor.rect.height - baseline,
        ),
      }))
      .filter(
        (item) =>
          item.distance <=
          Math.max(2, Math.max(item.anchor.fontSize, span.fontSize) * 0.55),
      )
      .sort((a, b) => a.distance - b.distance)[0];
    if (closest) closest.row.push(span);
    else rows.push([span]);
  }
  rows.sort((a, b) => (a[0]?.rect.y ?? 0) - (b[0]?.rect.y ?? 0));
  return rows
    .map((row) => {
      row.sort((a, b) => a.rect.x - b.rect.x);
      return {
        text: row
          .map((s) => s.text.trim())
          .filter(Boolean)
          .join(" "),
        rects: row.map((s) => s.rect),
        font: Math.max(...row.map((s) => s.fontSize)),
        y: row[0]?.rect.y ?? 0,
      };
    })
    .filter((line) => line.text.length > 0);
}
export function pageLines(page: PaperPage): Line[] {
  const spans = page.spans.filter(
    (s) => s.text.trim() && s.rect.width > 0 && s.rect.height > 0,
  );
  if (!spans.length)
    return page.text
      .split(/\n+/)
      .filter((s) => s.trim())
      .map((text, y) => ({ text: text.trim(), rects: [], font: 0, y }));
  const mid = page.width / 2;
  const left = spans.filter(
    (s) => s.rect.x < mid && s.rect.x + s.rect.width <= mid + 4,
  );
  const right = spans.filter((s) => s.rect.x >= mid - 4);
  const spanning = spans.filter((s) => !left.includes(s) && !right.includes(s));
  const twoColumns =
    left.length >= 4 &&
    right.length >= 4 &&
    spanning.length < spans.length * 0.3 &&
    left.some((s) => s.rect.x < page.width * 0.25) &&
    right.some((s) => s.rect.x < page.width * 0.7);
  if (!twoColumns) return mergeLines(spans);
  // Full-width headings/figures divide bands, each read left column then right.
  const result: Line[] = [];
  const dividers = mergeLines(spanning);
  let previousY = -Infinity;
  for (const divider of [
    ...dividers,
    { text: "", rects: [], font: 0, y: Infinity },
  ]) {
    result.push(
      ...mergeLines(
        left.filter((s) => s.rect.y >= previousY && s.rect.y < divider.y),
      ),
      ...mergeLines(
        right.filter((s) => s.rect.y >= previousY && s.rect.y < divider.y),
      ),
    );
    if (divider.text) result.push(divider);
    previousY = divider.y;
  }
  return result;
}
function classify(text: string, section: string[]): Chunk["kind"] {
  if (section.some((s) => /^(references|bibliography)$/i.test(s.trim())))
    return "references";
  if (/^(fig(?:ure)?\.?\s*\d)/i.test(text)) return "figure";
  if (/^table\s*\d/i.test(text)) return "table";
  if (
    (/[=∑∫∂]/u.test(text) && /\(\d+\)\s*$/.test(text)) ||
    /^equation\s*\d/i.test(text)
  )
    return "equation";
  return "text";
}
function sectionFor(paper: Paper, page: number): string[] {
  const path: string[] = [];
  for (const item of paper.outline
    .filter((o) => o.page <= page)
    .sort((a, b) => a.page - b.page)) {
    const depth = Math.max(0, Math.min(8, Math.floor(item.depth)));
    path.splice(depth);
    path[depth] = item.title;
  }
  return path.filter(Boolean);
}
function splitLine(line: Line, max: number): Line[] {
  if (line.text.length <= max) return [line];
  const result: Line[] = [];
  let text = line.text;
  while (text.length > max) {
    let end = text.lastIndexOf(" ", max);
    if (end < max / 2) end = max;
    result.push({ ...line, text: text.slice(0, end) });
    text = text.slice(end).trimStart();
  }
  if (text) result.push({ ...line, text });
  return result;
}
export function chunkPapers(
  papers: Paper[],
  childChars = 900,
  parentChars = 3200,
): Chunk[] {
  if (
    !Number.isInteger(childChars) ||
    childChars < 200 ||
    childChars > 3000 ||
    !Number.isInteger(parentChars) ||
    parentChars < 500 ||
    parentChars > 12000 ||
    parentChars < childChars
  )
    throw new RagError("configuration", "Invalid parent/child chunk size.");
  const chunks: Chunk[] = [];
  for (const paper of papers) {
    let runningSection: string[] = [];
    for (const page of [...paper.pages].sort((a, b) => a.number - b.number)) {
      const lines = pageLines(page);
      const fonts = lines
        .map((l) => l.font)
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      const medianFont = fonts[Math.floor(fonts.length / 2)] ?? 0;
      let section = runningSection.length
        ? [...runningSection]
        : sectionFor(paper, page.number);
      let parent: Line[] = [],
        parentSize = 0,
        parentKind: Chunk["kind"] = "text",
        parentNumber = 0;
      const flush = () => {
        if (!parent.length) return;
        const parentText = parent.map((l) => l.text).join(" ");
        const parentId = `${paper.id}:p${page.number}:g${parentNumber++}`;
        let child: Line[] = [],
          childSize = 0,
          childNumber = 0;
        const emit = () => {
          if (!child.length) return;
          const text = child.map((l) => l.text).join(" ");
          const rects = child
            .flatMap((l) => l.rects)
            .filter(
              (r, i, all) =>
                all.findIndex(
                  (x) =>
                    x.x === r.x &&
                    x.y === r.y &&
                    x.width === r.width &&
                    x.height === r.height,
                ) === i,
            );
          chunks.push({
            id: `${parentId}:c${childNumber++}`,
            paperId: paper.id,
            parentId,
            page: page.number,
            sectionPath: [...section],
            kind: parentKind,
            text,
            parentText,
            context: "",
            contextualText: text,
            rects,
            embedding: [],
          });
          child = [];
          childSize = 0;
        };
        for (const line of parent.flatMap((l) => splitLine(l, childChars))) {
          if (childSize + line.text.length + 1 > childChars) emit();
          child.push(line);
          childSize += line.text.length + 1;
        }
        emit();
        parent = [];
        parentSize = 0;
      };
      for (const line of lines.flatMap((l) => splitLine(l, parentChars))) {
        const normalizeHeading = (text: string) =>
          text
            .replace(/^\d+(?:\.\d+)*\.?\s*/, "")
            .trim()
            .toLowerCase();
        const outlined = paper.outline.find(
          (item) =>
            item.page === page.number &&
            normalizeHeading(item.title) === normalizeHeading(line.text),
        );
        const explicitRoot =
          /^(?:abstract|introduction|conclusion|references|bibliography|related work|methods|results|discussion|appendix(?:\s+.*)?)$/i.test(
            line.text,
          );
        const largeHeading = medianFont > 0 && line.font > medianFont * 1.2;
        const inReferences = section.some((s) =>
          /^(references|bibliography)$/i.test(s.trim()),
        );
        const numberedHeading = /^\d+(?:\.\d+)*\s+[A-Z]/.test(line.text);
        const heading =
          line.text.length < 130 &&
          (outlined !== undefined ||
            explicitRoot ||
            largeHeading ||
            (!inReferences && numberedHeading));
        if (heading) {
          flush();
          const number = line.text.match(/^(\d+(?:\.\d+)*)\s/);
          const depth =
            outlined?.depth ??
            (explicitRoot || inReferences
              ? 0
              : (number?.[1]?.split(".").length ?? 1) - 1);
          section = [...section.slice(0, depth), line.text];
          continue;
        }
        const kind = classify(line.text, section);
        if (
          parent.length &&
          (parentSize + line.text.length > parentChars || kind !== parentKind)
        )
          flush();
        parentKind = kind;
        parent.push(line);
        parentSize += line.text.length + 1;
      }
      flush();
      runningSection = section;
    }
  }
  return chunks;
}
