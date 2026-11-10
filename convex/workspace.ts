import { v, ConvexError } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireOwner } from "./identity";
import { z } from "zod";
import {
  paperSchema,
  pageSchema,
  annotationSchema,
  glossarySchema,
  settingsSchema,
  defaultSettings,
  chatMessageSchema,
  collectionSchema,
  chunkSchema,
  referenceSchema,
} from "../lib/domain";
import type { Paper } from "../lib/domain";
const metadataSchema = paperSchema.omit({ pages: true });
async function paperRecord(
  ctx: QueryCtx | MutationCtx,
  owner: string,
  paperId: string,
) {
  const record = await ctx.db
    .query("papers")
    .withIndex("by_owner_paper", (q) =>
      q.eq("owner", owner).eq("paperId", paperId),
    )
    .unique();
  if (!record) throw new ConvexError("Paper not found");
  return record;
}
async function hydrate(
  ctx: QueryCtx,
  record: Awaited<ReturnType<typeof paperRecord>>,
): Promise<Paper> {
  const pages = await ctx.db
    .query("pages")
    .withIndex("by_owner_paper", (q) =>
      q.eq("owner", record.owner).eq("paperId", record.paperId),
    )
    .collect();
  return paperSchema.parse({
    ...metadataSchema.parse(JSON.parse(record.json)),
    pages: pages
      .sort((a, b) => a.number - b.number)
      .map((p) => pageSchema.parse(JSON.parse(p.json))),
    pdfUrl: `/api/papers/${encodeURIComponent(record.paperId)}/pdf`,
  });
}
export const library = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const papers = await ctx.db
      .query("papers")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    const glossary = await ctx.db
      .query("glossary")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .unique();
    return {
      papers: await Promise.all(papers.map((p) => hydrate(ctx, p))),
      collections: collections.map((c) => collectionSchema.parse(c)),
      glossary: glossary.map((g) => glossarySchema.parse(JSON.parse(g.json))),
      settings: settings
        ? settingsSchema.parse(JSON.parse(settings.json))
        : defaultSettings,
    };
  },
});
export const getPaper = query({
  args: { paperId: v.string() },
  handler: async (ctx, args) =>
    hydrate(ctx, await paperRecord(ctx, await requireOwner(ctx), args.paperId)),
});
export const findDuplicate = query({
  args: { fingerprint: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const record = await ctx.db
      .query("papers")
      .withIndex("by_owner_fingerprint", (q) =>
        q.eq("owner", owner).eq("fingerprint", args.fingerprint),
      )
      .unique();
    return record ? record.paperId : null;
  },
});

export const pdfUrl = query({
  args: { paperId: v.string() },
  handler: async (ctx, args) => {
    const record = await paperRecord(
      ctx,
      await requireOwner(ctx),
      args.paperId,
    );
    return ctx.storage.getUrl(record.storageId);
  },
});
export const addPaper = mutation({
  args: {
    json: v.string(),
    fingerprint: v.string(),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const storageId = ctx.db.system.normalizeId("_storage", args.storageId);
    if (!storageId) throw new ConvexError("Invalid upload ID");
    const paper = paperSchema.parse(JSON.parse(args.json));
    const existing = await ctx.db
      .query("papers")
      .withIndex("by_owner_fingerprint", (q) =>
        q.eq("owner", owner).eq("fingerprint", args.fingerprint),
      )
      .unique();
    if (existing) {
      const claim = await ctx.db
        .query("uploads")
        .withIndex("by_storage", (q) => q.eq("storageId", storageId))
        .unique();
      if (claim?.owner === owner) {
        await ctx.storage.delete(storageId);
        await ctx.db.delete(claim._id);
      }
      return existing.paperId;
    }
    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .unique();
    if (!upload || upload.owner !== owner)
      throw new ConvexError("Upload does not belong to this workspace");
    const blob = await ctx.db.system.get(storageId);
    if (!blob || blob.size > 25 * 1024 * 1024)
      throw new ConvexError("Invalid uploaded PDF");
    await ctx.db.delete(upload._id);
    const owned = await ctx.db
      .query("papers")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    const matches = (
      ref: Paper["references"][number],
      target: Omit<Paper, "pages">,
    ): boolean => {
      if (
        ref.doi &&
        target.doi &&
        ref.doi.toLowerCase() === target.doi.toLowerCase()
      )
        return true;
      if (
        target.arxivId &&
        [ref.url, ref.pdfUrl, ref.raw].some((value) =>
          value?.includes(target.arxivId ?? "__none__"),
        )
      )
        return true;
      const clean = (title: string) =>
        title.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        clean(ref.title).length > 15 && clean(ref.title) === clean(target.title)
      );
    };
    for (const record of owned) {
      const target = metadataSchema.parse(JSON.parse(record.json));
      paper.references = paper.references.map((ref) =>
        matches(ref, target) ? { ...ref, ingestedPaperId: target.id } : ref,
      );
      const refs = target.references.map((ref) =>
        matches(ref, paper) ? { ...ref, ingestedPaperId: paper.id } : ref,
      );
      if (refs.some((ref, index) => ref !== target.references[index]))
        await ctx.db.patch(record._id, {
          json: JSON.stringify({ ...target, references: refs }),
        });
    }
    const { pages, ...metadata } = paper;
    await ctx.db.insert("papers", {
      owner,
      paperId: paper.id,
      json: JSON.stringify(metadata),
      fingerprint: args.fingerprint,
      storageId: storageId,
      updatedAt: Date.now(),
    });
    for (const page of pages)
      await ctx.db.insert("pages", {
        owner,
        paperId: paper.id,
        number: page.number,
        json: JSON.stringify(page),
      });
    return paper.id;
  },
});
const patchPaperSchema = metadataSchema
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
    status: true,
    error: true,
    references: true,
  })
  .partial()
  .strict();
export const patchPaper = mutation({
  args: { paperId: v.string(), json: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const record = await paperRecord(ctx, owner, args.paperId);
    const patch = patchPaperSchema.parse(JSON.parse(args.json));
    const metadata = metadataSchema.parse({
      ...JSON.parse(record.json),
      ...patch,
    });
    metadata.progress = Math.max(0, Math.min(1, metadata.progress));
    if (patch.currentPage !== undefined) {
      const pages = await ctx.db
        .query("pages")
        .withIndex("by_owner_paper", (q) =>
          q.eq("owner", owner).eq("paperId", args.paperId),
        )
        .collect();
      metadata.currentPage = Math.max(
        1,
        Math.min(pages.length, patch.currentPage),
      );
    }
    for (const id of metadata.collectionIds) {
      const collection = await ctx.db
        .query("collections")
        .withIndex("by_owner_id", (q) => q.eq("owner", owner).eq("id", id))
        .unique();
      if (!collection) throw new ConvexError("Collection not found");
    }
    await ctx.db.patch(record._id, {
      json: JSON.stringify(metadata),
      updatedAt: Date.now(),
    });
    return true;
  },
});
export const deletePaper = mutation({
  args: { paperId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const record = await paperRecord(ctx, owner, args.paperId);
    for (const table of [
      "pages",
      "annotations",
      "chunks",
      "messages",
    ] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_owner_paper", (q) =>
          q.eq("owner", owner).eq("paperId", args.paperId),
        )
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    const words = await ctx.db
      .query("glossary")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    for (const word of words)
      if (word.paperId === args.paperId) await ctx.db.delete(word._id);
    const citingPapers = await ctx.db
      .query("papers")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    for (const citing of citingPapers) {
      const metadata = metadataSchema.parse(JSON.parse(citing.json));
      if (
        metadata.references.some((ref) => ref.ingestedPaperId === args.paperId)
      ) {
        metadata.references = metadata.references.map((ref) => {
          if (ref.ingestedPaperId !== args.paperId) return ref;
          const { ingestedPaperId: removed, ...rest } = ref;
          void removed;
          return rest;
        });
        await ctx.db.patch(citing._id, { json: JSON.stringify(metadata) });
      }
    }
    const manifests = await ctx.db
      .query("indexes")
      .withIndex("by_owner_paper", (q) =>
        q.eq("owner", owner).eq("paperId", args.paperId),
      )
      .collect();
    for (const manifest of manifests) await ctx.db.delete(manifest._id);
    await ctx.storage.delete(record.storageId);
    await ctx.db.delete(record._id);
    return true;
  },
});
export const annotations = query({
  args: { paperId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    await paperRecord(ctx, owner, args.paperId);
    return (
      await ctx.db
        .query("annotations")
        .withIndex("by_owner_paper", (q) =>
          q.eq("owner", owner).eq("paperId", args.paperId),
        )
        .collect()
    ).map((row) => annotationSchema.parse(JSON.parse(row.json)));
  },
});
export const putAnnotation = mutation({
  args: { json: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const annotation = annotationSchema.parse(JSON.parse(args.json));
    await paperRecord(ctx, owner, annotation.paperId);
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_owner_paper", (q) =>
        q.eq("owner", owner).eq("paperId", annotation.paperId),
      )
      .collect();
    const page = pages.find((page) => page.number === annotation.page);
    if (!page) throw new ConvexError("Annotation page does not exist");
    const dimensions = pageSchema.parse(JSON.parse(page.json));
    if (
      annotation.text.length > 20000 ||
      annotation.comment.length > 20000 ||
      annotation.tags.length > 30 ||
      annotation.tags.some((tag) => tag.length > 80) ||
      annotation.rects.length > 2000
    )
      throw new ConvexError("Annotation exceeds the supported size");
    if (
      annotation.rects.some(
        (rect) =>
          rect.x < -1 ||
          rect.y < -1 ||
          rect.width < 0 ||
          rect.height < 0 ||
          rect.x + rect.width > dimensions.width + 2 ||
          rect.y + rect.height > dimensions.height + 2,
      )
    )
      throw new ConvexError("Annotation coordinates are outside the page");

    const existing = await ctx.db
      .query("annotations")
      .withIndex("by_owner_id", (q) =>
        q.eq("owner", owner).eq("id", annotation.id),
      )
      .unique();
    if (existing && existing.paperId !== annotation.paperId)
      throw new ConvexError("Annotation paper mismatch");
    if (existing)
      await ctx.db.patch(existing._id, { json: JSON.stringify(annotation) });
    else
      await ctx.db.insert("annotations", {
        owner,
        id: annotation.id,
        paperId: annotation.paperId,
        json: JSON.stringify(annotation),
      });
    return annotation;
  },
});
export const deleteAnnotation = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const row = await ctx.db
      .query("annotations")
      .withIndex("by_owner_id", (q) => q.eq("owner", owner).eq("id", args.id))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return true;
  },
});
export const putCollection = mutation({
  args: { json: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const c = collectionSchema.parse(JSON.parse(args.json));
    if (!c.name.trim() || c.name.length > 100)
      throw new ConvexError("Collection name must contain 1–100 characters");
    const existing = await ctx.db
      .query("collections")
      .withIndex("by_owner_id", (q) => q.eq("owner", owner).eq("id", c.id))
      .unique();
    if (existing) await ctx.db.patch(existing._id, c);
    else await ctx.db.insert("collections", { owner, ...c });
    return c;
  },
});
export const deleteCollection = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const row = await ctx.db
      .query("collections")
      .withIndex("by_owner_id", (q) => q.eq("owner", owner).eq("id", args.id))
      .unique();
    if (!row) return true;
    const papers = await ctx.db
      .query("papers")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    for (const paper of papers) {
      const metadata = metadataSchema.parse(JSON.parse(paper.json));
      if (metadata.collectionIds.includes(args.id)) {
        metadata.collectionIds = metadata.collectionIds.filter(
          (id) => id !== args.id,
        );
        await ctx.db.patch(paper._id, { json: JSON.stringify(metadata) });
      }
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_owner_paper", (q) =>
        q.eq("owner", owner).eq("paperId", `collection:${args.id}`),
      )
      .collect();
    for (const message of messages) await ctx.db.delete(message._id);
    await ctx.db.delete(row._id);
    return true;
  },
});
export const putGlossary = mutation({
  args: { json: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const word = glossarySchema.parse(JSON.parse(args.json));
    await paperRecord(ctx, owner, word.paperId);
    const words = await ctx.db
      .query("glossary")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .collect();
    const existing = words.find(
      (w) =>
        w.id === word.id ||
        (w.paperId === word.paperId &&
          w.term.toLocaleLowerCase() === word.term.toLocaleLowerCase()),
    );
    if (existing) {
      const merged = { ...word, id: existing.id };
      await ctx.db.patch(existing._id, {
        json: JSON.stringify(merged),
        term: merged.term,
      });
      return merged;
    }
    await ctx.db.insert("glossary", {
      owner,
      id: word.id,
      paperId: word.paperId,
      term: word.term,
      json: JSON.stringify(word),
    });
    return word;
  },
});
export const patchGlossary = mutation({
  args: { id: v.string(), json: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const row = await ctx.db
      .query("glossary")
      .withIndex("by_owner_id", (q) => q.eq("owner", owner).eq("id", args.id))
      .unique();
    if (!row) throw new ConvexError("Glossary term not found");
    const patch = glossarySchema
      .omit({ id: true, paperId: true, createdAt: true })
      .partial()
      .strict()
      .parse(JSON.parse(args.json));
    const word = glossarySchema.parse({ ...JSON.parse(row.json), ...patch });
    await ctx.db.patch(row._id, {
      json: JSON.stringify(word),
      term: word.term,
    });
    return word;
  },
});
export const deleteGlossary = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const row = await ctx.db
      .query("glossary")
      .withIndex("by_owner_id", (q) => q.eq("owner", owner).eq("id", args.id))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return true;
  },
});
export const patchSettings = mutation({
  args: { json: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const patch = settingsSchema
      .partial()
      .strict()
      .parse(JSON.parse(args.json));
    const row = await ctx.db
      .query("settings")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .unique();
    const settings = settingsSchema.parse({
      ...defaultSettings,
      ...(row ? JSON.parse(row.json) : {}),
      ...patch,
    });
    if (row) await ctx.db.patch(row._id, { json: JSON.stringify(settings) });
    else
      await ctx.db.insert("settings", {
        owner,
        json: JSON.stringify(settings),
      });
    return settings;
  },
});
export const chat = query({
  args: { paperId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    if (args.paperId.startsWith("collection:")) {
      const id = args.paperId.slice(11);
      const collection = await ctx.db
        .query("collections")
        .withIndex("by_owner_id", (q) => q.eq("owner", owner).eq("id", id))
        .unique();
      if (!collection) throw new ConvexError("Collection not found");
    } else await paperRecord(ctx, owner, args.paperId);
    return (
      await ctx.db
        .query("messages")
        .withIndex("by_owner_paper", (q) =>
          q.eq("owner", owner).eq("paperId", args.paperId),
        )
        .collect()
    )
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((row) => chatMessageSchema.parse(JSON.parse(row.json)));
  },
});
export const addMessages = mutation({
  args: { json: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const messages = z
      .array(chatMessageSchema)
      .max(2)
      .parse(JSON.parse(args.json));
    for (const message of messages) {
      if (!message.paperId.startsWith("collection:"))
        await paperRecord(ctx, owner, message.paperId);
      else {
        const c = await ctx.db
          .query("collections")
          .withIndex("by_owner_id", (q) =>
            q.eq("owner", owner).eq("id", message.paperId.slice(11)),
          )
          .unique();
        if (!c) throw new ConvexError("Collection not found");
      }
      await ctx.db.insert("messages", {
        owner,
        paperId: message.paperId,
        json: JSON.stringify(message),
        createdAt: message.createdAt,
      });
    }
    return true;
  },
});
export const replaceChunks = mutation({
  args: { paperId: v.string(), json: v.string(), version: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    await paperRecord(ctx, owner, args.paperId);
    const chunks = z.array(chunkSchema).parse(JSON.parse(args.json));
    if (
      chunks.some(
        (c) => c.paperId !== args.paperId || c.embedding.length !== 256,
      )
    )
      throw new ConvexError(
        "Chunk index has invalid paper or embedding dimensions",
      );
    const rows = await ctx.db
      .query("chunks")
      .withIndex("by_owner_paper", (q) =>
        q.eq("owner", owner).eq("paperId", args.paperId),
      )
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    for (const chunk of chunks)
      await ctx.db.insert("chunks", {
        owner,
        paperId: args.paperId,
        chunkId: chunk.id,
        json: JSON.stringify(chunk),
        embedding: chunk.embedding,
        version: args.version,
        scope: JSON.stringify([owner, args.paperId, args.version]),
        chunkScope: JSON.stringify([
          owner,
          args.paperId,
          args.version,
          chunk.id,
        ]),
      });
    return true;
  },
});
export const chunks = query({
  args: { paperId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    await paperRecord(ctx, owner, args.paperId);
    return (
      await ctx.db
        .query("chunks")
        .withIndex("by_owner_paper", (q) =>
          q.eq("owner", owner).eq("paperId", args.paperId),
        )
        .collect()
    ).map((row) => ({
      chunk: chunkSchema.parse(JSON.parse(row.json)),
      version: row.version,
    }));
  },
});

export const claimUpload = internalMutation({
  args: { owner: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.db.insert("uploads", { ...args, createdAt: Date.now() });
    await ctx.scheduler.runAfter(
      60 * 60 * 1000,
      internal.workspace.expireUpload,
      { storageId: args.storageId },
    );
  },
});
export const expireUpload = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("uploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (claim) {
      await ctx.storage.delete(claim.storageId);
      await ctx.db.delete(claim._id);
    }
  },
});
export const vectorHits = internalQuery({
  args: {
    owner: v.string(),
    ids: v.array(v.id("chunks")),
    paperIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const docs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return docs.flatMap((doc) =>
      doc && doc.owner === args.owner && args.paperIds.includes(doc.paperId)
        ? [{ id: doc._id, chunkId: doc.chunkId, version: doc.version }]
        : [],
    );
  },
});

export const updateReference = mutation({
  args: { paperId: v.string(), json: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const record = await paperRecord(ctx, owner, args.paperId);
    const metadata = metadataSchema.parse(JSON.parse(record.json));
    const reference = referenceSchema.parse(JSON.parse(args.json));
    if (!metadata.references.some((ref) => ref.id === reference.id))
      throw new ConvexError("Reference not found");
    metadata.references = metadata.references.map((ref) =>
      ref.id === reference.id ? reference : ref,
    );
    await ctx.db.patch(record._id, { json: JSON.stringify(metadata) });
    return reference;
  },
});

export const indexManifest = query({
  args: { paperId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    await paperRecord(ctx, owner, args.paperId);
    const record = await ctx.db
      .query("indexes")
      .withIndex("by_owner_paper", (q) =>
        q.eq("owner", owner).eq("paperId", args.paperId),
      )
      .unique();
    return record ? { json: record.json, version: record.version } : null;
  },
});
export const saveManifest = mutation({
  args: { paperId: v.string(), json: v.string(), version: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    await paperRecord(ctx, owner, args.paperId);
    if (args.json.length > 100000)
      throw new ConvexError("Index manifest exceeds limit");
    JSON.parse(args.json);
    const row = await ctx.db
      .query("indexes")
      .withIndex("by_owner_paper", (q) =>
        q.eq("owner", owner).eq("paperId", args.paperId),
      )
      .unique();
    if (row)
      await ctx.db.patch(row._id, { json: args.json, version: args.version });
    else await ctx.db.insert("indexes", { owner, ...args });
    return true;
  },
});

export const clearIndex = mutation({
  args: { paperId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    await paperRecord(ctx, owner, args.paperId);
    const rows = await ctx.db
      .query("indexes")
      .withIndex("by_owner_paper", (q) =>
        q.eq("owner", owner).eq("paperId", args.paperId),
      )
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return true;
  },
});

export const filteredVectorScopes = internalQuery({
  args: {
    owner: v.string(),
    paperIds: v.array(v.string()),
    version: v.string(),
    chunkIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const allowed = new Set(args.chunkIds);
    const result: string[] = [];
    for (const paperId of args.paperIds) {
      const rows = await ctx.db
        .query("chunks")
        .withIndex("by_owner_paper", (q) =>
          q.eq("owner", args.owner).eq("paperId", paperId),
        )
        .collect();
      for (const row of rows)
        if (row.version === args.version && allowed.has(row.chunkId))
          result.push(
            row.chunkScope ??
              JSON.stringify([args.owner, paperId, args.version, row.chunkId]),
          );
    }
    return result;
  },
});
