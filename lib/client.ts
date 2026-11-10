import { z } from "zod";
import {
  annotationSchema,
  answerSchema,
  chatMessageSchema,
  collectionSchema,
  glossarySchema,
  librarySchema,
  paperSchema,
  referenceSchema,
  settingsSchema,
  type Annotation,
  type AssistRequest,
  type GlossaryEntry,
  type Paper,
  type Settings,
} from "./domain";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(value);
    throw new ApiError(
      error.success
        ? error.data.error
        : `Request failed (${response.status}). Please retry.`,
      response.status,
    );
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      "The server returned an unexpected response. Please refresh and retry.",
      502,
    );
  return parsed.data;
}
const json = (body: unknown) => JSON.stringify(body);
const id = encodeURIComponent;
const ok = z.object({ ok: z.boolean() });
export const api = {
  library: (signal?: AbortSignal) =>
    request("/api/library", librarySchema, { signal }),
  import: (
    source: string | File,
    onProgress?: (percent: number) => void,
  ): Promise<Paper> => {
    // XHR reports real bytes sent; ingestion remains a separate, indeterminate stage.
    if (typeof source === "string")
      return request("/api/import", paperSchema, {
        method: "POST",
        body: json({ source }),
      });
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const body = new FormData();
      body.append("file", source);
      xhr.open("POST", "/api/import");
      xhr.timeout = 180000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () =>
        reject(
          new ApiError(
            "Upload connection failed. Check your connection and retry.",
            0,
          ),
        );
      xhr.ontimeout = () =>
        reject(
          new ApiError("Import timed out. Try a smaller PDF or retry.", 408),
        );
      xhr.onload = () => {
        let value: unknown;
        try {
          value = JSON.parse(xhr.responseText);
        } catch {
          reject(
            new ApiError("Import returned an invalid response.", xhr.status),
          );
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          const error = z.object({ error: z.string() }).safeParse(value);
          reject(
            new ApiError(
              error.success
                ? error.data.error
                : "Import failed. Retry with a PDF, DOI, arXiv ID or public URL.",
              xhr.status,
            ),
          );
          return;
        }
        const parsed = paperSchema.safeParse(value);
        if (parsed.success) resolve(parsed.data);
        else
          reject(new ApiError("The imported paper response was invalid.", 502));
      };
      xhr.send(body);
    });
  },
  paper: (
    paperId: string,
    patch: Partial<
      Pick<
        Paper,
        | "title"
        | "authors"
        | "abstract"
        | "year"
        | "venue"
        | "doi"
        | "tags"
        | "collectionIds"
        | "currentPage"
        | "progress"
      >
    >,
    keepalive = false,
  ) =>
    request(`/api/papers/${id(paperId)}`, paperSchema, {
      method: "PATCH",
      keepalive,
      body: json(patch),
    }),
  reindexPaper: (paperId: string) =>
    request(`/api/papers/${id(paperId)}/reindex`, ok, { method: "POST" }),
  deletePaper: (paperId: string) =>
    request(`/api/papers/${id(paperId)}`, ok, { method: "DELETE" }),
  annotations: (paperId: string, signal?: AbortSignal) =>
    request(
      `/api/annotations?paperId=${id(paperId)}`,
      z.array(annotationSchema),
      { signal },
    ),
  saveAnnotation: (annotation: Annotation) =>
    request("/api/annotations", annotationSchema, {
      method: "POST",
      body: json(annotation),
    }),
  deleteAnnotation: (annotationId: string) =>
    request(`/api/annotations/${id(annotationId)}`, ok, { method: "DELETE" }),
  chat: (paperId: string, signal?: AbortSignal) =>
    request(`/api/chat?paperId=${id(paperId)}`, z.array(chatMessageSchema), {
      signal,
    }),
  assist: (body: AssistRequest) =>
    request("/api/assist", answerSchema, { method: "POST", body: json(body) }),
  collection: (name: string, color: string) =>
    request("/api/collections", collectionSchema, {
      method: "POST",
      body: json({ name, color }),
    }),
  deleteCollection: (collectionId: string) =>
    request(`/api/collections/${id(collectionId)}`, ok, { method: "DELETE" }),
  glossary: (entry: GlossaryEntry) =>
    request("/api/glossary", glossarySchema, {
      method: "POST",
      body: json(entry),
    }),
  updateGlossary: (entryId: string, patch: Partial<GlossaryEntry>) =>
    request(`/api/glossary/${id(entryId)}`, glossarySchema, {
      method: "PATCH",
      body: json(patch),
    }),
  deleteGlossary: (entryId: string) =>
    request(`/api/glossary/${id(entryId)}`, ok, { method: "DELETE" }),
  settings: (patch: Partial<Settings>) =>
    request("/api/settings", settingsSchema, {
      method: "PATCH",
      body: json(patch),
    }),
  reference: (paperId: string, referenceId: string, signal?: AbortSignal) =>
    request(
      `/api/references?paperId=${id(paperId)}&referenceId=${id(referenceId)}`,
      referenceSchema,
      { signal },
    ),
};
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please retry.";
}
export function safeLink(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function pdfPath(paperId: string): string {
  return `/api/papers/${id(paperId)}/pdf`;
}

export function referencePreviewPath(
  paperId: string,
  referenceId: string,
): string {
  return `/api/reference-preview?paperId=${encodeURIComponent(paperId)}&referenceId=${encodeURIComponent(referenceId)}`;
}
