import { assistRequestSchema, paperSchema, type Paper } from "../../lib/domain";
export function syntheticPaper(
  id = "test",
  text = "The experiment uses a blue laser to measure atomic motion. The reported accuracy is ninety percent.",
): Paper {
  return paperSchema.parse({
    id,
    title: `Test paper ${id}`,
    authors: [],
    abstract: "",
    venue: "test",
    pdfUrl: "",
    pages: [
      {
        number: 1,
        width: 600,
        height: 800,
        text,
        spans: [
          {
            text,
            rect: { x: 40, y: 80, width: 500, height: 12 },
            fontSize: 12,
          },
        ],
      },
    ],
    outline: [{ title: "Methods", page: 1, depth: 0 }],
    references: [],
    tags: [],
    collectionIds: ["collection"],
    progress: 0,
    currentPage: 1,
    createdAt: 0,
    status: "ready",
  });
}
export function request(query = "What does the blue laser measure?") {
  return assistRequestSchema.parse({ query });
}
