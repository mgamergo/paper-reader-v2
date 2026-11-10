import { expect, test } from "bun:test";
import {
  answerQuestion,
  MockProvider,
  type DraftAnswer,
  type RagProvider,
} from "../../lib/rag";
import { request, syntheticPaper } from "../unit/rag-fixtures";
const text =
  "The model uses relevance scores to assign larger weights to input values.";
const translation =
  "मॉडल इनपुट मानों को अधिक भार देने के लिए प्रासंगिकता स्कोर का उपयोग करता है।";
class Translated extends MockProvider {
  override async answer(
    input: Parameters<RagProvider["answer"]>[0],
  ): Promise<DraftAnswer> {
    const evidence = input.evidence.find((e) => e.text.includes(text));
    if (!evidence) throw new Error("Missing fixture passage");
    const source = { chunkId: evidence.id, quote: text };
    return {
      sentences: [{ text, translation, evidence: [source] }],
      translation: "",
      terms: [
        {
          term: "relevance scores",
          definition: "Scores used to assign larger weights to input values.",
          translation:
            "इनपुट मानों को अधिक भार देने के लिए उपयोग किए जाने वाले स्कोर।",
          evidence: [source],
        },
      ],
      refused: false,
    };
  }
  override async verify(input: Parameters<RagProvider["verify"]>[0]) {
    return {
      supported: input.answer.sentences.map(() => true),
      translationSupported: true,
      termsSupported: true,
    };
  }
}
test("paired native sentences and definitions retain their own passage links and language", async () => {
  const answer = await answerQuestion({
    papers: [syntheticPaper("bilingual", text)],
    request: {
      ...request("How does the model assign weights?"),
      language: "Hindi",
    },
    provider: new Translated(),
  });
  expect(answer.refused).toBe(false);
  expect(answer.language).toBe("Hindi");
  expect(answer.translation).toBe(translation);
  expect(answer.sentences[0]?.translation).toBe(translation);
  expect(answer.sentences[0]?.citations[0]?.quote).toBe(text);
  expect(answer.terms[0]?.citations?.[0]?.quote).toBe(text);
  expect(answer.terms[0]?.translation).toContain("स्कोर");
  expect(answer.debug.stages).toContain("paired-translation-citations");
});
test("an unrelated global translation cannot be attached to valid English citations", async () => {
  class Unmapped extends Translated {
    override async answer(input: Parameters<RagProvider["answer"]>[0]) {
      const draft = await super.answer(input);
      return {
        ...draft,
        translation: "This extra claim is not paired to the cited sentence.",
      };
    }
  }
  const answer = await answerQuestion({
    papers: [syntheticPaper("bilingual", text)],
    request: { ...request(), language: "Hindi" },
    provider: new Unmapped(),
  });
  expect(answer.refused).toBe(true);
});
test("uncited or forged glossary definitions are rejected even when the model claims support", async () => {
  for (const evidence of [undefined, [{ chunkId: "forged", quote: text }]]) {
    class BadDefinition extends Translated {
      override async answer(input: Parameters<RagProvider["answer"]>[0]) {
        const draft = await super.answer(input);
        return {
          ...draft,
          terms: draft.terms.map((term) => ({ ...term, evidence })),
        };
      }
    }
    const answer = await answerQuestion({
      papers: [syntheticPaper("bilingual", text)],
      request: { ...request(), language: "Hindi" },
      provider: new BadDefinition(),
    });
    expect(answer.refused).toBe(true);
  }
});
test("unsupported paired translations cannot borrow a valid English source", async () => {
  class Unsupported extends Translated {
    override async verify(input: Parameters<RagProvider["verify"]>[0]) {
      return { ...(await super.verify(input)), translationSupported: false };
    }
  }
  const answer = await answerQuestion({
    papers: [syntheticPaper("bilingual", text)],
    request: { ...request(), language: "Hindi" },
    provider: new Unsupported(),
  });
  expect(answer.refused).toBe(true);
});
test("spaced decimals remain one cited claim throughout the public answer pipeline", async () => {
  const source =
    "The validation and testing components each contain 0 . 1% of the data, sampled uniformly at random.";
  const answer = await answerQuestion({
    papers: [syntheticPaper("numeric", source)],
    request: request("How are validation and testing components sampled?"),
  });
  expect(answer.refused).toBe(false);
  expect(answer.sentences).toHaveLength(1);
  expect(answer.sentences[0]?.text).toContain("0 . 1%");
  expect(answer.sentences[0]?.text).toContain("uniformly at random");
});

test("every English sentence requires a support verdict after splitting", async () => {
  class PartialVerification extends MockProvider {
    override async answer(
      input: Parameters<RagProvider["answer"]>[0],
    ): Promise<DraftAnswer> {
      const passage = input.evidence.find((item) => item.text.includes(text));
      if (!passage) throw new Error("Missing fixture");
      return {
        sentences: [
          {
            text: `${text} The model also cures disease.`,
            evidence: [{ chunkId: passage.id, quote: text }],
          },
        ],
        translation: "",
        terms: [],
        refused: false,
      };
    }
    override async verify() {
      return {
        supported: [true],
        translationSupported: true,
        termsSupported: true,
      };
    }
  }
  const answer = await answerQuestion({
    papers: [syntheticPaper("bilingual", text)],
    request: request(),
    provider: new PartialVerification(),
  });
  expect(answer.refused).toBe(true);
});

test("an English answer cannot be mislabeled with an unsolicited native translation", async () => {
  const answer = await answerQuestion({
    papers: [syntheticPaper("bilingual", text)],
    request: { ...request(), language: "English" },
    provider: new Translated(),
  });
  expect(answer.refused).toBe(true);
});
