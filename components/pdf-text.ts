import type { TextLayer } from "pdfjs-dist";
// Match across pdf.js runs while retaining DOM positions for real glyph highlights.
export function indexTextLayer(layer: TextLayer): {
  text: string;
  superscripts: { start: number; length: number; text: string }[];
  range: (start: number, length: number) => Range | null;
} {
  const characters: string[] = [];
  const runs: { start: number; text: string; element: HTMLElement }[] = [];
  const positions: ({ node: Text; offset: number } | null)[] = [];
  for (const div of layer.textDivs) {
    const node = div.firstChild;
    if (!(node instanceof Text)) continue;
    if (characters.length && characters.at(-1) !== " ") {
      characters.push(" ");
      positions.push(null);
    }
    runs.push({ start: characters.length, text: node.data, element: div });
    for (let offset = 0; offset < node.length; offset++) {
      const char = node.data[offset] ?? "";
      const value = /\s/.test(char) ? " " : char;
      if (value === " " && characters.at(-1) === " ") continue;
      characters.push(value);
      positions.push({ node, offset });
    }
  }
  const superscripts = runs.flatMap((run, index) => {
    const value = run.text.trim();
    if (!/^\d{1,3}$/.test(value)) return [];
    const rect = run.element.getBoundingClientRect();
    const raised = [runs[index - 1], runs[index + 1]].some((neighbor) => {
      if (!neighbor) return false;
      const other = neighbor.element.getBoundingClientRect();
      return (
        rect.height < other.height * 0.9 &&
        rect.bottom < other.bottom - other.height * 0.1 &&
        Math.min(
          Math.abs(rect.left - other.right),
          Math.abs(other.left - rect.right),
        ) < 60
      );
    });
    return raised
      ? [
          {
            start: run.start + run.text.indexOf(value),
            length: value.length,
            text: value,
          },
        ]
      : [];
  });
  return {
    text: characters.join(""),
    superscripts,
    range(start, length) {
      const points = positions
        .slice(start, start + length)
        .filter(
          (position): position is { node: Text; offset: number } =>
            position !== null,
        );
      const first = points[0];
      const last = points.at(-1);
      if (!first || !last) return null;
      const range = document.createRange();
      range.setStart(first.node, first.offset);
      range.setEnd(last.node, last.offset + 1);
      return range;
    },
  };
}
export function normalizeSearch(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}
