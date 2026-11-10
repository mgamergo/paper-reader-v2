import type { Annotation, Paper } from "./domain";
export function escapeBibtex(value: string): string {
  const escapes: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    "%": "\\%",
    "&": "\\&",
    _: "\\_",
    "#": "\\#",
    $: "\\$",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return value
    .replace(/[\\{}%&_#$~^]/g, (char) => escapes[char] ?? char)
    .replace(/[\r\n]+/g, " ");
}
export function toBibtex(paper: Paper): string {
  const key =
    `${paper.authors[0]?.split(/\s+/).at(-1) ?? "paper"}${paper.year ?? "nd"}${paper.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 6)}`.replace(
      /[^A-Za-z0-9]/g,
      "",
    ) || "paper";
  const fields: [string, string | undefined][] = [
    ["title", paper.title],
    ["author", paper.authors.map(escapeBibtex).join(" and ")],
    ["year", paper.year?.toString()],
    ["journal", paper.venue],
    ["doi", paper.doi],
    ["url", paper.sourceUrl],
    ["abstract", paper.abstract],
  ];
  return `@article{${key},\n${fields
    .filter(([, value]) => value)
    .map(
      ([field, value]) =>
        `  ${field} = {${field === "author" ? value : escapeBibtex(value ?? "")}}`,
    )
    .join(",\n")}\n}\n`;
}
const markdown = (text: string) => text.replace(/([\\`*_{}\[\]<>#|])/g, "\\$1");
export function annotationsMarkdown(
  paper: Paper,
  annotations: Annotation[],
): string {
  return `# ${markdown(paper.title)}\n\n${paper.authors.map(markdown).join(", ")}\n\n${annotations
    .filter((item) => item.paperId === paper.id)
    .sort((a, b) => a.page - b.page || a.createdAt - b.createdAt)
    .map(
      (item) =>
        `## Page ${item.page} · ${item.kind}\n\n${
          item.text
            ? item.text
                .split("\n")
                .map((line) => `> ${markdown(line)}`)
                .join("\n") + "\n\n"
            : ""
        }${markdown(item.comment)}${item.tags.length ? `\n\nTags: ${item.tags.map(markdown).join(", ")}` : ""}\n`,
    )
    .join("\n")}`;
}
export function downloadText(
  text: string,
  filename: string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
