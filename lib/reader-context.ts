import type { Paper, Rect } from "./domain";

export function paragraphContext(
  paper: Pick<Paper, "pages">,
  page: number,
  text: string,
  rects: Rect[],
): string {
  const data = paper.pages.find((p) => p.number === page);
  if (!data) return text;
  const anchor = rects[0];
  let position = data.text.indexOf(text);
  if (anchor) {
    let cursor = 0;
    let nearest = Infinity;
    for (const span of data.spans) {
      const start = data.text.indexOf(span.text, cursor);
      if (start < 0) continue;
      cursor = start + span.text.length;
      const distance =
        Math.abs(span.rect.y - anchor.y) +
        Math.abs(span.rect.x - anchor.x) * 0.1;
      if (span.text.includes(text) && distance < nearest) {
        nearest = distance;
        position = start + span.text.indexOf(text);
      }
    }
  }
  if (position >= 0) {
    const before = data.text.lastIndexOf("\n\n", position);
    const after = data.text.indexOf("\n\n", position + text.length);
    return data.text.slice(
      Math.max(before < 0 ? 0 : before + 2, position - 3000),
      after < 0
        ? Math.min(data.text.length, position + text.length + 3000)
        : Math.min(after, position + text.length + 3000),
    );
  }
  return (
    anchor
      ? data.spans
          .filter((s) => Math.abs(s.rect.y - anchor.y) < 150)
          .map((s) => s.text)
          .join(" ")
      : data.text
  ).slice(0, 16000);
}

export function internalReferenceTarget(
  paper: Pick<Paper, "pages">,
  kind: "fig" | "table" | "eq",
  number: string,
) {
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const caption = new RegExp(
    `^(?:${kind === "fig" ? "Fig(?:ure)?\\.?" : kind === "table" ? "Table" : "Eq(?:uation)?\\.?"})\\s*\\(?${escaped}\\b`,
    "i",
  );
  const numberedEquation = new RegExp(`\\(${escaped}\\)\\s*$`);
  return paper.pages
    .flatMap((p) =>
      p.spans.map((span, i) => ({
        page: p.number,
        span,
        previous: p.spans[i - 1],
      })),
    )
    .find(
      (item) =>
        caption.test(item.span.text) ||
        (kind === "eq" &&
          numberedEquation.test(item.span.text) &&
          /[=∑∫√+−×]/.test(`${item.span.text} ${item.previous?.text ?? ""}`)),
    );
}
