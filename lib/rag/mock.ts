import type { RagProvider, DraftAnswer } from "./contracts";
import { tokens } from "./ranking";
import { splitSentences } from "./text";

function sentences(text: string): string[] {
  return splitSentences(text).filter((sentence) => sentence.length >= 20);
}
function lexicalTerms(text: string): string[] {
  return tokens(text)
    .map((term) =>
      term === "runs"
        ? "run"
        : term.length > 4 && term.endsWith("s") && !term.endsWith("ss")
          ? term.slice(0, -1)
          : term,
    )
    .filter((term) => !["work", "works", "often", "during"].includes(term));
}
function relevance(query: string, text: string): number {
  const terms = [...new Set(lexicalTerms(query))];
  const found = new Set(lexicalTerms(text));
  return terms.length
    ? terms.filter((t) => found.has(t)).length / terms.length
    : 0;
}
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function substantive(text: string): boolean {
  return (
    /[.!?]$/.test(text) &&
    (text.match(/[=√∑∫∂]/g)?.length ?? 0) < 2 &&
    (text.match(/[a-z]+/gi)?.length ?? 0) >= 7 &&
    /\b(is|are|was|were|has|have|use[sd]?|include[sd]?|contain[sd]?|compute[sd]?|provide[sd]?|measure[sd]?|consists?|reduce[sd]?|replace[sd]?|apply|applies|train(?:ed)?|perform[sd]?|we|can|will)\b/i.test(
      text,
    ) &&
    (!/\bwe (?:call|name|refer to)\b/i.test(text) ||
      /\b(?:runs?|provides?|because|since|therefore|computes?|divides?|applies)\b/i.test(
        text,
      ))
  );
}
function candidateScore(
  query: string,
  text: string,
  section: string[],
  wholeChunk: string,
): { score: number; eligible: boolean } {
  const direct = relevance(query, text),
    sectionScore = relevance(query, section.join(" ")),
    context = relevance(query, wholeChunk);
  const procedural =
    /^how\b/i.test(query) &&
    /\b(compute|divide|apply|multiply|aggregate|normalize|map|project|sample|shard|concatenate)[a-z]*\b/i.test(
      text,
    )
      ? 0.15
      : 0;
  return {
    score: Math.min(
      1,
      0.5 * direct + 0.35 * sectionScore + 0.15 * context + procedural,
    ),
    eligible: direct >= 0.45 || (sectionScore >= 0.5 && direct >= 0.15),
  };
}

/** Deterministic lexical test double. It has no learned semantics or translation model. */
export class MockProvider implements RagProvider {
  readonly name = "offline-extractive-mock";
  readonly identity = {
    provider: "offline",
    model: "token-hash",
    dimensions: 256,
    revision: "4",
  };
  readonly contextIdentity = "offline-title-section-excerpt-v1";
  readonly limitations = [
    "Offline mock: token-hash vectors are not semantic embeddings.",
    "Offline mock: extractive English only; translation and simplification require a real provider.",
    "Offline mock: lexical sentence and section heuristics reject headings; they do not establish answer completeness.",
  ];
  async contextualize(input: Parameters<RagProvider["contextualize"]>[0]) {
    const excerpt = sentences(input.parent)[0] ?? input.text.slice(0, 180);
    return `In ${input.title}, section ${input.section.join(" / ") || "Body"}, this passage discusses: ${excerpt.slice(0, 500)}`;
  }
  async expand(query: string) {
    const terms = tokens(query);
    return {
      rewrite: terms.join(" ") || query,
      queries: [
        `${terms.slice().reverse().join(" ")} evidence`,
        `${query} method results`,
      ],
      hyde: `A relevant paper passage would discuss ${terms.join(" ")} and describe the method and its results.`,
    };
  }
  async embed(texts: string[]) {
    return texts.map((text) => {
      const vector = Array.from({ length: this.identity.dimensions }, () => 0);
      for (const token of tokens(text)) {
        let hash = 2166136261;
        for (const char of token)
          hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
        const slot = hash % vector.length;
        vector[slot] = (vector[slot] ?? 0) + 1;
      }
      if (!vector.some((n) => n !== 0)) vector[0] = 1;
      const norm = Math.hypot(...vector);
      return vector.map((n) => n / norm);
    });
  }
  async rerank(input: Parameters<RagProvider["rerank"]>[0]) {
    return input.evidence.map((e) => ({
      id: e.id,
      score: Math.max(
        ...sentences(e.text)
          .filter(substantive)
          .map(
            (s) => candidateScore(input.query, s, e.sectionPath, e.text).score,
          ),
        0,
      ),
    }));
  }
  async answer({
    request,
    evidence,
  }: Parameters<RagProvider["answer"]>[0]): Promise<DraftAnswer> {
    if (request.action === "related") {
      const cited = evidence
        .filter(
          (chunk) => chunk.kind === "references" && chunk.text.length >= 8,
        )
        .flatMap((chunk) =>
          splitSentences(chunk.text).map((text) => ({
            text,
            evidence: [
              {
                chunkId: chunk.id,
                quote: text.length >= 8 ? text : chunk.text,
              },
            ],
          })),
        );
      const unique = [
        ...new Map(cited.map((claim) => [claim.text, claim])).values(),
      ].slice(0, 8);
      return {
        sentences: unique,
        terms: [],
        translation: "",
        refused: unique.length === 0,
      };
    }
    const query = request.selection
      ? `${request.query} ${request.selection.text}`
      : request.query;
    const candidates = evidence.flatMap((e) =>
      sentences(e.text)
        .filter(substantive)
        .map((text) => ({
          text,
          chunkId: e.id,
          ...candidateScore(query, text, e.sectionPath, e.text),
        })),
    );
    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates
      .filter((c) =>
        request.action === "summarize" ? c.score >= 0.15 : c.eligible,
      )
      .slice(0, request.action === "summarize" ? 5 : 2);
    const definitions = selected.flatMap((candidate) => {
      const term = candidate.text
        .match(
          /^([\p{L}][\p{L}\p{N} -]{0,80}?)\s+(?:is|are|refers to|means)\b/u,
        )?.[1]
        ?.trim();
      return term && term.split(/\s+/).length <= 6
        ? [
            {
              term,
              definition: candidate.text,
              evidence: [{ chunkId: candidate.chunkId, quote: candidate.text }],
            },
          ]
        : [];
    });
    // Definitions remain verbatim source sentences; the mock cannot translate.
    return {
      sentences: selected.map((c) => ({
        text: c.text,
        evidence: [{ chunkId: c.chunkId, quote: c.text }],
      })),
      translation: "",
      terms: definitions,
      refused: !selected.length,
    };
  }
  async verify({
    answer,
    evidence,
    request,
  }: Parameters<RagProvider["verify"]>[0]) {
    return {
      supported: answer.sentences.map((s) =>
        s.evidence.some((c) => {
          const chunk = evidence.find((e) => e.id === c.chunkId);
          return (
            chunk !== undefined &&
            normalize(chunk.text).includes(normalize(c.quote)) &&
            (normalize(c.quote) === normalize(s.text) ||
              (request.action === "related" &&
                chunk.kind === "references" &&
                normalize(c.quote).includes(normalize(s.text))))
          );
        }),
      ),
      translationSupported: answer.translation === "",
      termsSupported: answer.terms.every(
        (term) =>
          !term.translation &&
          term.evidence?.some((c) => {
            const chunk = evidence.find((e) => e.id === c.chunkId);
            return (
              !!chunk &&
              normalize(chunk.text).includes(normalize(c.quote)) &&
              normalize(c.quote) === normalize(term.definition)
            );
          }) === true,
      ),
    };
  }
}
