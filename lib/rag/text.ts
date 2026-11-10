export function splitSentences(text: string): string[] {
  const period = "\uE000";
  const normalized = text.replace(/\s+/g, " ");
  const protectedText = normalized
    .replace(/(?<=\d)\s*\.\s*(?=\d)/g, (part) => part.replaceAll(".", period))
    .replace(/\b(?:et al|e\.g|i\.e|Fig|Eq|Dr|Prof|vs)\./gi, (part) =>
      part.replaceAll(".", period),
    )
    .replace(/\b[A-Z]\.(?=\s+[A-Z][a-z])/g, (part) =>
      part.replaceAll(".", period),
    );
  return [...protectedText.matchAll(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)]
    .map((match) =>
      normalized.slice(match.index, match.index + match[0].length).trim(),
    )
    .filter(Boolean);
}
