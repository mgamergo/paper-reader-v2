import { randomUUID } from "node:crypto";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { requestClient, apiError } from "@/lib/server/api";
import { importPaper } from "@/lib/server/import";
import {
  askLibrary,
  persistedIndex,
  configuredProvider,
} from "@/lib/server/rag";
import {
  ImportError,
  readJsonBody,
  readRequestBytes,
  fetchPublicResource,
} from "@/lib/server/network";
import { enrichReference } from "@/lib/server/metadata";
import {
  librarySchema,
  paperSchema,
  annotationSchema,
  glossarySchema,
  settingsSchema,
  assistRequestSchema,
  collectionSchema,
} from "@/lib/domain";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context): Promise<Response> {
  try {
    const { client, token } = await requestClient(request);
    const { path } = await context.params;
    const [resource, id, child] = path;
    const url = new URL(request.url);
    const method = request.method;
    if (resource === "library" && method === "GET")
      return Response.json(
        librarySchema.parse(await client.query(api.workspace.library, {})),
      );
    if (resource === "import" && method === "POST") {
      if (Number(request.headers.get("content-length") ?? 0) > 26 * 1024 * 1024)
        throw new ImportError("PDF files must be smaller than 25 MB.", 413);
      let file: File | undefined;
      let source: string | undefined;
      if (
        request.headers.get("content-type")?.includes("multipart/form-data")
      ) {
        const body = await readRequestBytes(request, 26 * 1024 * 1024);
        const form = await new Request(request.url, {
          method: "POST",
          headers: {
            "content-type": request.headers.get("content-type") ?? "",
          },
          body: new Uint8Array(body),
        }).formData();
        const value = form.get("file");
        if (value instanceof File) file = value;
        else throw new ImportError("Select a PDF file.");
      } else
        source = z
          .object({ source: z.string().min(1).max(2000) })
          .parse(await readJsonBody(request)).source;
      const paper = await importPaper({ client, token, file, source });
      try {
        await persistedIndex(client, [paper], configuredProvider());
        await client.mutation(api.workspace.patchPaper, {
          paperId: paper.id,
          json: JSON.stringify({ status: "ready", error: "" }),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Indexing failed";
        await client.mutation(api.workspace.patchPaper, {
          paperId: paper.id,
          json: JSON.stringify({
            status: "error",
            error: message.slice(0, 300),
          }),
        });
      }
      return Response.json(
        paperSchema.parse(
          await client.query(api.workspace.getPaper, { paperId: paper.id }),
        ),
        { status: 201 },
      );
    }
    if (resource === "papers" && id) {
      if (child === "reindex" && method === "POST") {
        const paper = paperSchema.parse(
          await client.query(api.workspace.getPaper, { paperId: id }),
        );
        await client.mutation(api.workspace.clearIndex, { paperId: id });
        await persistedIndex(client, [paper], configuredProvider());
        await client.mutation(api.workspace.patchPaper, {
          paperId: id,
          json: JSON.stringify({ status: "ready", error: "" }),
        });
        return Response.json({ ok: true });
      }
      if (child === "pdf" && method === "GET") {
        const storageUrl = await client.query(api.workspace.pdfUrl, {
          paperId: id,
        });
        if (!storageUrl)
          throw new ImportError("This PDF is no longer available.", 404);
        const response = await fetch(storageUrl, {
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok)
          throw new ImportError(
            "The PDF could not be loaded from storage.",
            502,
          );
        return new Response(response.body, {
          headers: {
            "Content-Type": "application/pdf",
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": 'inline; filename="research-paper.pdf"',
          },
        });
      }
      if (method === "GET")
        return Response.json(
          paperSchema.parse(
            await client.query(api.workspace.getPaper, { paperId: id }),
          ),
        );
      if (method === "PATCH") {
        const patch = paperSchema
          .pick({
            title: true,
            authors: true,
            abstract: true,
            year: true,
            venue: true,
            doi: true,
            tags: true,
            collectionIds: true,
            progress: true,
            currentPage: true,
          })
          .partial()
          .strict()
          .parse(await readJsonBody(request));
        await client.mutation(api.workspace.patchPaper, {
          paperId: id,
          json: JSON.stringify(patch),
        });
        return Response.json(
          paperSchema.parse(
            await client.query(api.workspace.getPaper, { paperId: id }),
          ),
        );
      }
      if (method === "DELETE") {
        await client.mutation(api.workspace.deletePaper, { paperId: id });
        return Response.json({ ok: true });
      }
    }
    if (resource === "annotations") {
      if (method === "GET") {
        const paperId = z
          .string()
          .min(1)
          .parse(url.searchParams.get("paperId"));
        return Response.json(
          z
            .array(annotationSchema)
            .parse(await client.query(api.workspace.annotations, { paperId })),
        );
      }
      if (method === "POST") {
        const entry = annotationSchema.parse(await readJsonBody(request));
        return Response.json(
          annotationSchema.parse(
            await client.mutation(api.workspace.putAnnotation, {
              json: JSON.stringify(entry),
            }),
          ),
        );
      }
      if (id && method === "DELETE") {
        await client.mutation(api.workspace.deleteAnnotation, { id });
        return Response.json({ ok: true });
      }
    }
    if (resource === "collections") {
      if (method === "POST") {
        const data = z
          .object({
            name: z.string().trim().min(1).max(100),
            color: z.string().max(30),
          })
          .parse(await readJsonBody(request));
        return Response.json(
          collectionSchema.parse(
            await client.mutation(api.workspace.putCollection, {
              json: JSON.stringify({ id: randomUUID(), ...data }),
            }),
          ),
        );
      }
      if (id && method === "DELETE") {
        await client.mutation(api.workspace.deleteCollection, { id });
        return Response.json({ ok: true });
      }
    }
    if (resource === "glossary") {
      if (method === "POST")
        return Response.json(
          glossarySchema.parse(
            await client.mutation(api.workspace.putGlossary, {
              json: JSON.stringify(
                glossarySchema.parse(await readJsonBody(request)),
              ),
            }),
          ),
        );
      if (id && method === "PATCH")
        return Response.json(
          glossarySchema.parse(
            await client.mutation(api.workspace.patchGlossary, {
              id,
              json: JSON.stringify(
                glossarySchema
                  .omit({ id: true, paperId: true, createdAt: true })
                  .partial()
                  .strict()
                  .parse(await readJsonBody(request)),
              ),
            }),
          ),
        );
      if (id && method === "DELETE") {
        await client.mutation(api.workspace.deleteGlossary, { id });
        return Response.json({ ok: true });
      }
    }
    if (resource === "settings" && method === "PATCH")
      return Response.json(
        settingsSchema.parse(
          await client.mutation(api.workspace.patchSettings, {
            json: JSON.stringify(
              settingsSchema
                .partial()
                .strict()
                .parse(await readJsonBody(request)),
            ),
          }),
        ),
      );
    if (resource === "chat" && method === "GET") {
      const paperId = z.string().min(1).parse(url.searchParams.get("paperId"));
      return Response.json(await client.query(api.workspace.chat, { paperId }));
    }
    if (resource === "reference-preview" && method === "GET") {
      const paperId = z.string().min(1).parse(url.searchParams.get("paperId"));
      const referenceId = z
        .string()
        .min(1)
        .parse(url.searchParams.get("referenceId"));
      const paper = paperSchema.parse(
        await client.query(api.workspace.getPaper, { paperId }),
      );
      const reference = paper.references.find((ref) => ref.id === referenceId);
      if (!reference?.pdfUrl)
        throw new ImportError(
          "No open PDF preview is available for this reference.",
          404,
        );
      const preview = await fetchPublicResource(reference.pdfUrl);
      if (
        !new TextDecoder()
          .decode(preview.bytes.slice(0, 1024))
          .includes("%PDF-")
      )
        throw new ImportError("This source did not return a PDF preview.", 422);
      return new Response(new Uint8Array(preview.bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, max-age=600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (resource === "references" && method === "GET") {
      const paperId = z.string().min(1).parse(url.searchParams.get("paperId"));
      const referenceId = z
        .string()
        .min(1)
        .parse(url.searchParams.get("referenceId"));
      const paper = paperSchema.parse(
        await client.query(api.workspace.getPaper, { paperId }),
      );
      const reference = paper.references.find((ref) => ref.id === referenceId);
      if (!reference)
        throw new ImportError("This reference was not found.", 404);
      let enriched = reference;
      try {
        enriched = await enrichReference(reference);
      } catch {
        return Response.json(reference);
      }
      await client.mutation(api.workspace.updateReference, {
        paperId,
        json: JSON.stringify(enriched),
      });
      return Response.json(enriched);
    }
    if (resource === "assist" && method === "POST") {
      const input = assistRequestSchema.parse(await readJsonBody(request));
      if (!input.paperId && !input.collectionId)
        throw new ImportError("Choose a paper or collection first.");
      const library = librarySchema.parse(
        await client.query(api.workspace.library, {}),
      );
      const historyKey = input.collectionId
        ? `collection:${input.collectionId}`
        : input.paperId;
      if (!historyKey) throw new ImportError("Choose a paper or collection.");
      const history = await client.query(api.workspace.chat, {
        paperId: historyKey,
      });
      const previous = history
        .filter((message) => message.role === "user")
        .slice(-2)
        .map((message) => message.text);
      const retrievalRequest = {
        ...input,
        query:
          previous.length &&
          /^(what about|and |how about|why |can you elaborate|explain more|it |this |that )/i.test(
            input.query,
          )
            ? `${previous.join("\n")}\nFollow-up: ${input.query}`
            : input.query,
      };
      const answer = await askLibrary({
        client,
        papers: library.papers,
        request: retrievalRequest,
      });
      const time = Date.now();
      await client.mutation(api.workspace.addMessages, {
        json: JSON.stringify([
          {
            id: randomUUID(),
            paperId: historyKey,
            role: "user",
            text: input.query,
            createdAt: time,
          },
          {
            id: randomUUID(),
            paperId: historyKey,
            role: "assistant",
            text: answer.refused
              ? "This is not supported by the paper."
              : answer.sentences.map((sentence) => sentence.text).join(" "),
            answer,
            createdAt: time + 1,
          },
        ]),
      });
      return Response.json(answer);
    }
    throw new ImportError("This endpoint was not found.", 404);
  } catch (error) {
    return apiError(error);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
