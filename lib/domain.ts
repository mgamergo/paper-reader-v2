import { z } from "zod";
export const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type Rect = z.infer<typeof rectSchema>;
export const spanSchema = z.object({
  text: z.string(),
  rect: rectSchema,
  fontSize: z.number(),
});
export const pageSchema = z.object({
  number: z.number().int().positive(),
  width: z.number(),
  height: z.number(),
  text: z.string(),
  spans: z.array(spanSchema),
});
export type PaperPage = z.infer<typeof pageSchema>;
export const referenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  raw: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().optional(),
  venue: z.string().optional(),
  abstract: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  pdfUrl: z.string().optional(),
  ingestedPaperId: z.string().optional(),
});
export type Reference = z.infer<typeof referenceSchema>;
export const outlineSchema = z.object({
  title: z.string(),
  page: z.number(),
  depth: z.number(),
});
export const paperSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  abstract: z.string(),
  year: z.number().optional(),
  venue: z.string(),
  doi: z.string().optional(),
  arxivId: z.string().optional(),
  sourceUrl: z.string().optional(),
  pdfUrl: z.string(),
  storageId: z.string().optional(),
  pages: z.array(pageSchema),
  outline: z.array(outlineSchema),
  references: z.array(referenceSchema),
  tags: z.array(z.string()),
  collectionIds: z.array(z.string()),
  progress: z.number(),
  currentPage: z.number(),
  createdAt: z.number(),
  status: z.enum(["ready", "indexing", "error"]),
  error: z.string().optional(),
});
export type Paper = z.infer<typeof paperSchema>;
export const annotationSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  page: z.number(),
  kind: z.enum(["highlight", "note", "bookmark"]),
  text: z.string(),
  comment: z.string(),
  color: z.enum(["yellow", "green", "blue", "pink", "purple"]),
  rects: z.array(rectSchema),
  tags: z.array(z.string()),
  createdAt: z.number(),
});
export type Annotation = z.infer<typeof annotationSchema>;
export const glossarySchema = z.object({
  id: z.string(),
  paperId: z.string(),
  term: z.string(),
  definition: z.string(),
  translation: z.string(),
  language: z.string(),
  context: z.string(),
  dueAt: z.number(),
  interval: z.number(),
  repetitions: z.number(),
  createdAt: z.number(),
});
export type GlossaryEntry = z.infer<typeof glossarySchema>;
export const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});
export type Collection = z.infer<typeof collectionSchema>;
export const settingsSchema = z.object({
  language: z.string(),
  theme: z.enum(["light", "dark", "sepia"]),
  difficulty: z.number(),
  shortcuts: z.record(z.string(), z.string()),
  readingMode: z.enum(["continuous", "single"]),
  pageAppearance: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  language: "Hindi",
  theme: "light",
  difficulty: 2,
  shortcuts: {},
  readingMode: "continuous",
  pageAppearance: false,
};
export const librarySchema = z.object({
  papers: z.array(paperSchema),
  collections: z.array(collectionSchema),
  glossary: z.array(glossarySchema),
  settings: settingsSchema,
});
export type Library = z.infer<typeof librarySchema>;
export const passageCitationSchema = z.object({
  chunkId: z.string(),
  paperId: z.string(),
  page: z.number(),
  quote: z.string(),
  rects: z.array(rectSchema),
});
export type PassageCitation = z.infer<typeof passageCitationSchema>;
export const chunkSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  parentId: z.string(),
  sectionPath: z.array(z.string()),
  kind: z.enum(["text", "figure", "table", "equation", "references"]),
  page: z.number(),
  text: z.string(),
  parentText: z.string(),
  context: z.string(),
  contextualText: z.string(),
  rects: z.array(rectSchema),
  embedding: z.array(z.number()),
});
export type Chunk = z.infer<typeof chunkSchema>;
export const retrievalFilterSchema = z.object({
  section: z.string().optional(),
  kind: z
    .enum(["text", "figure", "table", "equation", "references"])
    .optional(),
  expandCitations: z.boolean().optional(),
});
export type RetrievalFilter = z.infer<typeof retrievalFilterSchema>;
export const debugHitSchema = z.object({
  chunk: chunkSchema,
  score: z.number(),
  stages: z.record(z.string(), z.number()),
  ranks: z.record(z.string(), z.number()),
});
export type DebugHit = z.infer<typeof debugHitSchema>;
export const answerSchema = z.object({
  sentences: z.array(
    z.object({ text: z.string(), citations: z.array(passageCitationSchema) }),
  ),
  translation: z.string(),
  terms: z.array(z.object({ term: z.string(), definition: z.string() })),
  refused: z.boolean(),
  provider: z.string(),
  debug: z.object({
    queries: z.array(z.string()),
    hyde: z.string(),
    hits: z.array(debugHitSchema),
    stages: z.array(z.string()),
    elapsedMs: z.number(),
    filters: retrievalFilterSchema,
  }),
});
export type RagAnswer = z.infer<typeof answerSchema>;
export const assistRequestSchema = z.object({
  paperId: z.string().optional(),
  collectionId: z.string().optional(),
  query: z.string().min(1).max(4000),
  action: z
    .enum([
      "chat",
      "explain",
      "define",
      "summarize",
      "translate",
      "related",
      "simplify",
      "equation",
      "figure",
    ])
    .default("chat"),
  selection: z
    .object({
      text: z.string().max(8000),
      context: z.string().max(16000),
      page: z.number(),
    })
    .optional(),
  language: z.string().max(50).default("English"),
  difficulty: z.number().min(1).max(5).default(2),
  filters: retrievalFilterSchema.default({}),
});
export type AssistRequest = z.infer<typeof assistRequestSchema>;
export const chatMessageSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  answer: answerSchema.optional(),
  createdAt: z.number(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
