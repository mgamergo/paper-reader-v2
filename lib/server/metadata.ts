import { z } from "zod";
import type { Paper, Reference } from "../domain";
import { extractDoi } from "./citations";
import { fetchPublicResource, ImportError, validatePublicUrl } from "./network";
export type ImportSource =
  | { kind: "doi"; id: string }
  | { kind: "arxiv"; id: string }
  | { kind: "url"; url: string };
export type ResolvedSource = {
  metadata: Partial<
    Pick<
      Paper,
      | "title"
      | "authors"
      | "abstract"
      | "year"
      | "venue"
      | "doi"
      | "arxivId"
      | "sourceUrl"
    >
  >;
  pdfUrl?: string;
  landingUrl: string;
};
export function parseImportSource(input: string): ImportSource {
  const source = input.trim();
  if (!source || source.length > 2000)
    throw new ImportError("Enter a DOI, arXiv ID, or public PDF URL.");
  const doi = source.match(
    /^(?:doi\s*:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i,
  )?.[1];
  if (doi) return { kind: "doi", id: doi.replace(/[.,]+$/, "") };
  const arxiv = source.match(
    /^(?:(?:arxiv\s*:\s*)|(?:https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\/))?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)(?:\.pdf)?$/i,
  )?.[1];
  if (arxiv) return { kind: "arxiv", id: arxiv };
  return { kind: "url", url: validatePublicUrl(source).href };
}
function decodeEntities(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_all, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}
function xmlTag(xml: string, tag: string): string {
  return decodeEntities(
    xml.match(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
    )?.[1] ?? "",
  );
}
const crossrefSchema = z.object({
  message: z.object({
    title: z.array(z.string()).optional(),
    author: z
      .array(
        z.object({
          given: z.string().optional(),
          family: z.string().optional(),
        }),
      )
      .optional(),
    abstract: z.string().optional(),
    "container-title": z.array(z.string()).optional(),
    DOI: z.string().optional(),
    URL: z.string().optional(),
    issued: z.object({ "date-parts": z.array(z.array(z.number())) }).optional(),
    link: z
      .array(
        z.object({ URL: z.string(), "content-type": z.string().optional() }),
      )
      .optional(),
  }),
});
export async function resolveDoi(id: string): Promise<ResolvedSource> {
  const arxiv = id.match(/^10\.48550\/arxiv\.(.+)$/i)?.[1];
  if (arxiv) {
    const source = parseImportSource(arxiv);
    if (source.kind !== "arxiv") throw new ImportError("Invalid arXiv DOI.");
    const resolved = await resolveArxiv(source.id);
    return { ...resolved, metadata: { ...resolved.metadata, doi: id } };
  }

  const resource = await fetchPublicResource(
    `https://api.crossref.org/works/${encodeURIComponent(id)}`,
    { maxBytes: 2 * 1024 * 1024, accept: "application/json" },
  );
  const item = crossrefSchema.parse(
    JSON.parse(Buffer.from(resource.bytes).toString("utf8")),
  ).message;
  const pdfUrl = item.link?.find(
    (link) => link["content-type"] === "application/pdf",
  )?.URL;
  let openPdf = pdfUrl;
  if (!openPdf && process.env.UNPAYWALL_EMAIL) {
    try {
      const oa = await fetchPublicResource(
        `https://api.unpaywall.org/v2/${encodeURIComponent(id)}?email=${encodeURIComponent(process.env.UNPAYWALL_EMAIL)}`,
        { maxBytes: 1024 * 1024, accept: "application/json" },
      );
      const result = z
        .object({
          best_oa_location: z
            .object({ url_for_pdf: z.string().nullable() })
            .nullable(),
        })
        .parse(JSON.parse(Buffer.from(oa.bytes).toString("utf8")));
      openPdf = result.best_oa_location?.url_for_pdf ?? undefined;
    } catch {
      openPdf = undefined;
    }
  }
  return {
    metadata: {
      title: item.title?.[0],
      authors: item.author?.map((a) =>
        [a.given, a.family].filter(Boolean).join(" "),
      ),
      abstract: item.abstract ? decodeEntities(item.abstract) : undefined,
      year: item.issued?.["date-parts"][0]?.[0],
      venue: item["container-title"]?.[0],
      doi: item.DOI ?? id,
      sourceUrl: item.URL ?? `https://doi.org/${id}`,
    },
    ...(openPdf ? { pdfUrl: openPdf } : {}),
    landingUrl: item.URL ?? `https://doi.org/${id}`,
  };
}
export async function resolveArxiv(id: string): Promise<ResolvedSource> {
  const resource = await fetchPublicResource(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
    { maxBytes: 2 * 1024 * 1024, accept: "application/atom+xml" },
  );
  const xml = Buffer.from(resource.bytes).toString("utf8");
  const entry = xml.match(/<entry\b[^>]*>([\s\S]*?)<\/entry>/i)?.[1];
  if (!entry || /error/i.test(xmlTag(entry, "title")))
    throw new ImportError("This arXiv paper was not found. Check the ID.", 404);
  const title = xmlTag(entry, "title");
  const authors = [
    ...entry.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi),
  ].map((match) => xmlTag(match[1] ?? "", "name"));
  const date = xmlTag(entry, "published");
  const year = Number(date.slice(0, 4));
  const doi = xmlTag(entry, "arxiv:doi");
  return {
    metadata: {
      title,
      authors,
      abstract: xmlTag(entry, "summary"),
      ...(Number.isFinite(year) ? { year } : {}),
      venue: xmlTag(entry, "arxiv:journal_ref") || "arXiv",
      ...(doi ? { doi } : {}),
      arxivId: id,
      sourceUrl: `https://arxiv.org/abs/${id}`,
    },
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    landingUrl: `https://arxiv.org/abs/${id}`,
  };
}
export async function resolveImportSource(
  input: string,
): Promise<ResolvedSource> {
  const source = parseImportSource(input);
  switch (source.kind) {
    case "doi":
      return resolveDoi(source.id);
    case "arxiv":
      return resolveArxiv(source.id);
    case "url":
      return {
        metadata: { sourceUrl: source.url },
        pdfUrl: source.url,
        landingUrl: source.url,
      };
  }
}
export async function enrichReference(
  reference: Reference,
): Promise<Reference> {
  let resolved: ResolvedSource | undefined;
  const doi = reference.doi ?? extractDoi(reference.raw);
  if (doi) resolved = await resolveDoi(doi);
  else if (reference.url?.includes("arxiv.org")) {
    const source = parseImportSource(reference.url);
    if (source.kind === "arxiv") resolved = await resolveArxiv(source.id);
  } else {
    const search = await fetchPublicResource(
      `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(reference.title)}&rows=1`,
      { maxBytes: 2 * 1024 * 1024, accept: "application/json" },
    );
    const result = z
      .object({
        message: z.object({
          items: z.array(
            z.object({
              DOI: z.string(),
              title: z.array(z.string()).optional(),
              score: z.number().optional(),
            }),
          ),
        }),
      })
      .parse(JSON.parse(Buffer.from(search.bytes).toString("utf8")));
    const first = result.message.items[0];
    const words = new Set(
      reference.title.toLowerCase().match(/\p{L}{3,}/gu) ?? [],
    );
    const candidate =
      first?.title?.[0]?.toLowerCase().match(/\p{L}{3,}/gu) ?? [];
    const overlap =
      candidate.filter((word) => words.has(word)).length /
      Math.max(words.size, candidate.length, 1);
    if (first && overlap >= 0.65) resolved = await resolveDoi(first.DOI);
  }
  if (!resolved) return reference;
  const m = resolved.metadata;
  return {
    ...reference,
    ...(m.title ? { title: m.title } : {}),
    ...(m.authors?.length ? { authors: m.authors } : {}),
    ...(m.abstract ? { abstract: m.abstract } : {}),
    ...(m.year ? { year: m.year } : {}),
    ...(m.venue ? { venue: m.venue } : {}),
    ...(m.doi ? { doi: m.doi } : {}),
    url: resolved.landingUrl,
    ...(resolved.pdfUrl ? { pdfUrl: resolved.pdfUrl } : {}),
  };
}
