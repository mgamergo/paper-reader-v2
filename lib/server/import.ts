import { createHash, randomUUID } from "node:crypto";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../convex/_generated/api";
import { paperSchema, type Paper } from "../domain";
import { parsePdf } from "./pdf";
import { resolveImportSource, resolveDoi } from "./metadata";
import { fetchPublicResource, ImportError } from "./network";
export async function importPaper({
  client,
  token,
  file,
  source,
}: {
  client: ConvexHttpClient;
  token: string | null;
  file?: File;
  source?: string;
}): Promise<Paper> {
  let bytes: Uint8Array;
  let filename = "paper.pdf";
  let metadata: Partial<Paper> = {};
  if (file) {
    if (file.size > 25 * 1024 * 1024)
      throw new ImportError("PDF files must be smaller than 25 MB.", 413);
    filename = file.name;
    bytes = new Uint8Array(await file.arrayBuffer());
  } else if (source) {
    const resolved = await resolveImportSource(source);
    metadata = resolved.metadata;
    if (!resolved.pdfUrl)
      throw new ImportError(
        "Metadata was found, but an open PDF was not available. Download an authorized copy and upload it. Add UNPAYWALL_EMAIL to enable more open-access sources.",
        422,
      );
    const resource = await fetchPublicResource(resolved.pdfUrl);
    bytes = resource.bytes;
    metadata.sourceUrl = resolved.landingUrl;
  } else
    throw new ImportError(
      "Choose a PDF file or enter a DOI, arXiv ID, or public PDF URL.",
    );
  const fingerprint = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await client.query(api.workspace.findDuplicate, {
    fingerprint,
  });
  if (duplicate)
    return paperSchema.parse(
      await client.query(api.workspace.getPaper, { paperId: duplicate }),
    );
  const parsed = await parsePdf(bytes, filename);
  if (file && parsed.doi) {
    try {
      const resolved = await resolveDoi(parsed.doi);
      metadata = { ...resolved.metadata };
    } catch {
      metadata = {};
    }
  }
  const paper = paperSchema.parse({
    ...parsed,
    ...Object.fromEntries(
      Object.entries(metadata).filter(
        ([, value]) => value !== undefined && value !== "",
      ),
    ),
    id: randomUUID(),
    pdfUrl: "",
    tags: [],
    collectionIds: [],
    progress: 0,
    currentPage: 1,
    createdAt: Date.now(),
    status: "ready",
  });
  paper.pdfUrl = `/api/papers/${encodeURIComponent(paper.id)}/pdf`;
  const site =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
    (process.env.APP_MODE === "local" ? "http://127.0.0.1:3211" : undefined);
  if (!site) throw new ImportError("Convex HTTP actions URL is missing.", 503);
  const stored = await fetch(`${site}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(30000),
  });
  if (!stored.ok)
    throw new ImportError(
      "The PDF could not be saved to file storage. Retry the import.",
      502,
    );
  const upload = z.object({ storageId: z.string() }).parse(await stored.json());
  paper.storageId = upload.storageId;
  const id = await client.mutation(api.workspace.addPaper, {
    json: JSON.stringify(paper),
    fingerprint,
    storageId: upload.storageId,
  });
  return paperSchema.parse(
    await client.query(api.workspace.getPaper, { paperId: id }),
  );
}
