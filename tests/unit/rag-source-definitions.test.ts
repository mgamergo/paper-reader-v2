import { expect, test } from "bun:test";
import { MockProvider } from "../../lib/rag";
import { assistRequestSchema } from "../../lib/domain";
test("offline glossary definitions are exact source text with independent evidence", async () => {
  const provider = new MockProvider();
  const evidence = [
    {
      id: "c",
      paperId: "p",
      page: 1,
      text: "Attention is a mechanism that assigns different weights to input tokens.",
      parentText: "",
      sectionPath: ["Attention"],
      kind: "text" as const,
    },
  ];
  const request = assistRequestSchema.parse({
    query: "Explain Attention",
    selection: {
      text: "Attention",
      context: evidence[0]?.text,
      page: 1,
      rects: [],
    },
  });
  const answer = await provider.answer({ request, evidence });
  expect(answer.terms[0]?.definition).toBe(evidence[0]?.text);
  expect(answer.terms[0]?.evidence?.[0]?.chunkId).toBe("c");
  expect(
    (await provider.verify({ request, evidence, answer })).termsSupported,
  ).toBe(true);
  if (answer.terms[0]) answer.terms[0].definition = "A fabricated definition";
  expect(
    (await provider.verify({ request, evidence, answer })).termsSupported,
  ).toBe(false);
});
