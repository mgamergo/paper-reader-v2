import type { PaperPage, Reference } from "../domain";
export function extractDoi(text: string): string | undefined {
  return text
    .match(/\b10\.\d{4,9}\/[a-z0-9._;()/:-]+/i)?.[0]
    ?.replace(/[.,;]+$/, "");
}
export function parseReference(raw: string, label: string): Reference {
  const cleaned = raw
    .replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  const doi = extractDoi(cleaned);
  const yearValue = cleaned.match(/\b(?:19|20)\d{2}\b/)?.[0];
  const year = yearValue ? Number(yearValue) : undefined;
  const url = cleaned
    .match(/https?:\/\/[^\s<>]+/i)?.[0]
    ?.replace(/[.,;)]+$/, "");
  const segments = cleaned.split(/\.\s+(?=[A-Z“"\d])/);
  const first = segments[0] ?? cleaned;
  const authors = first
    .split(/,\s*(?=[A-Z][a-z])|\s+and\s+/)
    .filter(Boolean)
    .slice(0, 15);
  let title = segments[1] ?? cleaned;
  const yearEnd = cleaned.match(/^(.+?)\(?((?:19|20)\d{2})\)?[.,:]\s*(.+)$/);
  if (yearEnd) {
    title = (yearEnd[3] ?? title).split(/\.\s/)[0] ?? title;
  }
  title = title
    .replace(/^\d{4}[.,]?\s*/, "")
    .replace(/[“”"]/g, "")
    .trim();
  const arxiv = cleaned.match(
    /(?:arxiv\s*:\s*|arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5}(?:v\d+)?)/i,
  )?.[1];
  return {
    id: `ref-${label}`,
    label,
    raw: cleaned,
    title: title || cleaned,
    authors,
    ...(year ? { year } : {}),
    ...(doi ? { doi, url: `https://doi.org/${doi}` } : url ? { url } : {}),
    ...(arxiv
      ? {
          url: `https://arxiv.org/abs/${arxiv}`,
          pdfUrl: `https://arxiv.org/pdf/${arxiv}`,
        }
      : {}),
    ...(segments.length > 2
      ? { venue: segments.slice(2).join(". ").slice(0, 300) }
      : {}),
  };
}
export function parseReferences(pages: PaperPage[]): Reference[] {
  const text = pages.map((p) => p.text).join("\n");
  const heading =
    /(?:^|\n)\s*(?:\d+\.?\s+)?(?:references|bibliography|literature cited)\s*(?:\n|$)/gi;
  let match: RegExpExecArray | null;
  let start = -1;
  while ((match = heading.exec(text))) start = match.index + match[0].length;
  if (start < 0) return [];
  const bibliography =
    text
      .slice(start)
      .split(/\n\s*(?:appendix|supplementary materials)\b/i)[0] ?? "";
  const rows = bibliography
    .split(/\n(?=\s*(?:\[\d{1,4}\]|\d{1,4}[.)])\s*)/)
    .filter((row) => /^\s*(?:\[\d+\]|\d+[.)])/.test(row));
  if (rows.length)
    return rows.slice(0, 500).map((row) =>
      parseReference(
        row,
        row
          .match(/^\s*(?:\[(\d+)\]|(\d+)[.)])/)
          ?.slice(1)
          .find(Boolean) ?? "?",
      ),
    );
  const authorRows = bibliography
    .split(/\n(?=[A-Z][\p{L}'’-]+,\s+[A-Z])/u)
    .map((s) => s.trim())
    .filter((s) => /\b(?:19|20)\d{2}\b/.test(s));
  return authorRows
    .slice(0, 500)
    .map((row, index) => parseReference(row, String(index + 1)));
}
export function resolveCitationLabels(
  text: string,
  references: Reference[],
): Reference[] {
  const labels = new Set<string>();
  for (const match of text.matchAll(/\[([\d\s,–-]+)\]/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const range = part.trim().split(/[–-]/).map(Number);
      const first = range[0];
      if (first === undefined || !Number.isFinite(first)) continue;
      const end = range[1] ?? first;
      if (end - first > 100) continue;
      for (let n = first; n <= end; n++) labels.add(String(n));
    }
  }
  const candidates = references.filter((ref) => labels.has(ref.label));
  for (const ref of references) {
    if (!ref.year) continue;
    const author = ref.authors[0] ?? "";
    const surname =
      author.split(",")[0]?.split(" ").filter(Boolean).at(-1) ?? "";
    if (
      surname &&
      new RegExp(
        `\\b${surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^()]{0,35}\\b${ref.year}\\b`,
        "i",
      ).test(text)
    )
      candidates.push(ref);
  }
  return [...new Map(candidates.map((ref) => [ref.id, ref])).values()];
}
