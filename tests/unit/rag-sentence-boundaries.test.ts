import { expect, test } from "bun:test";
import { MockProvider } from "../../lib/rag/mock";
import { assistRequestSchema } from "../../lib/domain";
import type { Evidence } from "../../lib/rag/contracts";
async function answer(query: string, text: string) {
  const provider = new MockProvider();
  const request = assistRequestSchema.parse({ query, language: "English" });
  const evidence: Evidence[] = [
    {
      id: "source",
      paperId: "fixture",
      page: 1,
      kind: "text",
      text,
      parentText: text,
      sectionPath: ["Methods"],
    },
  ];
  const draft = await provider.answer({ request, evidence });
  const verdict = await provider.verify({ request, evidence, answer: draft });
  expect(verdict.supported.every(Boolean)).toBe(true);
  return draft;
}
test("procedural explanations survive author abbreviations and PDF line hyphenation", async () => {
  const result = await answer(
    "How does FSDP reduce memory consumption?",
    "We train models with the FSDP framework (Example et al., 2024), which re- duces memory consumption by sharding weights and the corresponding optimizer state across GPUs.",
  );
  expect(result.refused).toBe(false);
  expect(result.sentences.map((s) => s.text).join(" ")).toContain(
    "sharding weights",
  );
  expect(result.sentences.map((s) => s.text).join(" ")).toContain(
    "optimizer state",
  );
});
test("decimal extraction spacing does not end a sentence before its explanation", async () => {
  const result = await answer(
    "How are validation and testing components sampled?",
    "The validation and testing components each contain 0 . 1% of the data, sampled uniformly at random.",
  );
  expect(result.refused).toBe(false);
  expect(result.sentences[0]?.text).toContain("0 . 1%");
  expect(result.sentences[0]?.text).toContain("uniformly at random");
});
test("a naming clause remains usable when it also explains behavior", async () => {
  const result = await answer(
    "How often does online evaluation run during training?",
    "We call this online evaluation as it runs every 250 training steps and provides a signal on the model being trained.",
  );
  expect(result.refused).toBe(false);
  expect(result.sentences[0]?.text).toContain("250 training steps");
});
test("protecting punctuation does not rewrite original private-use glyphs", async () => {
  const text =
    "The tokenizer preserves the private glyph \uE000 in its vocabulary and uses a special decoding rule.";
  const result = await answer(
    "What does the tokenizer preserve in its vocabulary?",
    text,
  );
  expect(result.refused).toBe(false);
  expect(result.sentences[0]?.text).toBe(text);
});
