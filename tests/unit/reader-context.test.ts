import { expect, test } from "bun:test";
import {
  paragraphContext,
  internalReferenceTarget,
} from "../../lib/reader-context";
import { allowedWriteOrigin } from "../../lib/server/origin";
const rect = { x: 40, y: 20, width: 300, height: 12 };
const pages = [
  {
    number: 1,
    width: 600,
    height: 800,
    text: "Contextual Reading and Attention\n\nAttention is a mechanism that assigns weights to input tokens.\n\nSee Eq. (1).\n\na = b + c (1)",
    spans: [
      { text: "Contextual Reading and Attention", rect, fontSize: 16 },
      {
        text: "Attention is a mechanism that assigns weights to input tokens.",
        rect: { ...rect, y: 120 },
        fontSize: 12,
      },
      { text: "See Eq. (1).", rect: { ...rect, y: 160 }, fontSize: 12 },
      { text: "a = b + c (1)", rect: { ...rect, y: 200 }, fontSize: 12 },
    ],
  },
];
test("selection coordinates distinguish repeated words and preserve first character", () => {
  expect(
    paragraphContext({ pages }, 1, "Attention", [{ ...rect, y: 120 }]),
  ).toBe("Attention is a mechanism that assigns weights to input tokens.");
  expect(paragraphContext({ pages }, 1, "Contextual", [rect])).toBe(
    "Contextual Reading and Attention",
  );
});
test("numbered formulas resolve equation previews rather than prose mentions", () => {
  expect(internalReferenceTarget({ pages }, "eq", "1")?.span.text).toBe(
    "a = b + c (1)",
  );
  expect(internalReferenceTarget({ pages }, "eq", "2")).toBeUndefined();
});
test("local normalized loopback origins preserve ports and reject external writes", () => {
  const request = (origin: string) =>
    new Request("http://localhost:3000/api/import", {
      method: "POST",
      headers: { origin },
    });
  expect(allowedWriteOrigin(request("http://127.0.0.1:3000"), true)).toBe(true);
  for (const origin of [
    "http://127.0.0.1:3001",
    "https://localhost:3000",
    "https://example.com",
    "null",
  ])
    expect(allowedWriteOrigin(request(origin), true)).toBe(false);
  expect(allowedWriteOrigin(request("http://127.0.0.1:3000"), false)).toBe(
    false,
  );
});

test("equation labels separated from formulas by whitespace PDF spans resolve", () => {
  const spans = [
    { text: "a = b + c", rect, fontSize: 12 },
    { text: " ", rect: { ...rect, x: 200 }, fontSize: 12 },
    { text: "(1)", rect: { ...rect, x: 250 }, fontSize: 12 },
  ];
  expect(
    internalReferenceTarget({ pages: [{ ...pages[0]!, spans }] }, "eq", "1")
      ?.span.text,
  ).toBe("(1)");
});
