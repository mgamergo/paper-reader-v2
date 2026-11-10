import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireOwner } from "./identity";
export const dense = action({
  args: {
    vector: v.array(v.float64()),
    paperIds: v.array(v.string()),
    version: v.string(),
  },
  handler: async (ctx, args): Promise<{ chunkId: string; score: number }[]> => {
    const owner = await requireOwner(ctx);
    if (args.vector.length !== 384)
      throw new Error("Embedding dimension must be 384");
    if (args.paperIds.length > 100)
      throw new Error("Search supports at most 100 papers per request");
    const results = await Promise.all(
      args.paperIds.map((paperId) =>
        ctx.vectorSearch("chunks", "by_embedding", {
          vector: args.vector,
          limit: 64,
          filter: (q) =>
            q.eq("scope", JSON.stringify([owner, paperId, args.version])),
        }),
      ),
    );
    const ranked = results.flat().sort((a, b) => b._score - a._score);
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
