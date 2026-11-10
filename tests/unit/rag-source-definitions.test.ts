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

test("offline procedural answers retain original comparison evidence", async () => {
  const provider = new MockProvider();
  const text =
    "A query compares against keys to determine the weights applied to values.";
  const evidence = [
    {
      id: "comparison",
      paperId: "p",
      page: 1,
      text,
      parentText: "",
      sectionPath: ["Methods"],
      kind: "text",
    },
  ] satisfies Parameters<MockProvider["answer"]>[0]["evidence"];
  const request = assistRequestSchema.parse({
    query: "How does a query determine the weights applied to values?",
  });
  const answer = await provider.answer({ request, evidence });
  expect(answer.refused).toBe(false);
  expect(answer.sentences.map((sentence) => sentence.text)).toEqual([text]);
  expect(answer.sentences[0]?.evidence).toEqual([
    { chunkId: "comparison", quote: text },
  ]);
  expect(
    (await provider.verify({ request, evidence, answer })).supported,
  ).toEqual([true]);
});
