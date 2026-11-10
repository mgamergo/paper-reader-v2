import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireOwner } from "./identity";
export const dense = action({
  args: {
    vector: v.array(v.float64()),
    paperIds: v.array(v.string()),
    version: v.string(),
    allowedChunkIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ chunkId: string; score: number }[]> => {
    const owner = await requireOwner(ctx);
    if (args.vector.length !== 256)
      throw new Error("Embedding dimension must be 256");
    if (
      args.paperIds.length > 100 ||
      (args.allowedChunkIds?.length ?? 0) > 20000
    )
      throw new Error("Search scope exceeds the supported limit");
    const groups: string[][] = [];
    if (args.allowedChunkIds) {
      const scopes: string[] = await ctx.runQuery(
        internal.workspace.filteredVectorScopes,
        {
          owner,
          paperIds: args.paperIds,
          version: args.version,
          chunkIds: args.allowedChunkIds,
        },
      );
      for (let offset = 0; offset < scopes.length; offset += 128)
        groups.push(scopes.slice(offset, offset + 128));
    } else
      for (const paperId of args.paperIds)
        groups.push([JSON.stringify([owner, paperId, args.version])]);
    const results = [];
    for (const scopes of groups) {
      const hits = await ctx.vectorSearch("chunks", "by_embedding", {
        vector: args.vector,
        limit: 64,
        filter: (q) =>
          args.allowedChunkIds
            ? q.or(...scopes.map((scope) => q.eq("chunkScope", scope)))
            : q.eq("scope", scopes[0] ?? ""),
      });
      results.push(...hits);
    }
    const ranked = results.sort((a, b) => b._score - a._score);
    const records: { id: string; chunkId: string; version: string }[] =
      await ctx.runQuery(internal.workspace.vectorHits, {
        owner,
        ids: ranked.map((hit) => hit._id),
        paperIds: args.paperIds,
      });
    const allowed = new Map(
      records
        .filter((row) => row.version === args.version)
        .map((row) => [row.id, row.chunkId]),
    );
    return ranked.flatMap((hit) => {
      const chunkId = allowed.get(hit._id);
      return chunkId ? [{ chunkId, score: hit._score }] : [];
    });
  },
});
