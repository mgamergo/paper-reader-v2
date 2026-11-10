import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  uploads: defineTable({
    owner: v.string(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  }).index("by_storage", ["storageId"]),
  papers: defineTable({
    owner: v.string(),
    paperId: v.string(),
    json: v.string(),
    fingerprint: v.string(),
    storageId: v.id("_storage"),
    updatedAt: v.number(),
  })
    .index("by_owner", ["owner"])
    .index("by_owner_paper", ["owner", "paperId"])
    .index("by_owner_fingerprint", ["owner", "fingerprint"]),
  pages: defineTable({
    owner: v.string(),
    paperId: v.string(),
    number: v.number(),
    json: v.string(),
  }).index("by_owner_paper", ["owner", "paperId"]),
  annotations: defineTable({
    owner: v.string(),
    id: v.string(),
    paperId: v.string(),
    json: v.string(),
  })
    .index("by_owner_paper", ["owner", "paperId"])
    .index("by_owner_id", ["owner", "id"]),
  collections: defineTable({
    owner: v.string(),
    id: v.string(),
    name: v.string(),
    color: v.string(),
  })
    .index("by_owner", ["owner"])
    .index("by_owner_id", ["owner", "id"]),
  glossary: defineTable({
    owner: v.string(),
    id: v.string(),
    paperId: v.string(),
    term: v.string(),
    json: v.string(),
  })
    .index("by_owner", ["owner"])
    .index("by_owner_id", ["owner", "id"]),
  settings: defineTable({ owner: v.string(), json: v.string() }).index(
    "by_owner",
    ["owner"],
  ),
  messages: defineTable({
    owner: v.string(),
    paperId: v.string(),
    json: v.string(),
    createdAt: v.number(),
  }).index("by_owner_paper", ["owner", "paperId"]),
  chunks: defineTable({
    owner: v.string(),
    paperId: v.string(),
    chunkId: v.string(),
    json: v.string(),
    embedding: v.array(v.float64()),
    version: v.string(),
    scope: v.string(),
  })
    .index("by_owner_paper", ["owner", "paperId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 384,
      filterFields: ["owner", "paperId", "version", "scope"],
    }),
});
