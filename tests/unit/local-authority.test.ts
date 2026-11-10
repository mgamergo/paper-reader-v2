import { expect, test } from "bun:test";
import {
  localRequestAllowed,
  allowedWriteOrigin,
} from "../../lib/server/origin";
test("local access validates the incoming authority even when Next normalizes request URL", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"])
    expect(
      localRequestAllowed(
        new Request("http://localhost:3000/api/library", { headers: { host } }),
      ),
    ).toBe(true);
  for (const host of [
    "review.invalid:3000",
    "localhost:3000\\ignored",
    "localhost:3001",
    "localhost:3000/path",
    "localhost:3000@review.invalid",
    "",
  ])
    expect(
      localRequestAllowed(
        new Request("http://localhost:3000/api/library", { headers: { host } }),
      ),
    ).toBe(false);
  expect(
    localRequestAllowed(new Request("http://localhost:3000/api/library")),
  ).toBe(false);
});
test("hosted same-origin writes use incoming Host and retain strict scheme and authority matching", () => {
  const make = (origin: string) =>
    new Request("https://localhost/api/import", {
      method: "POST",
      headers: { host: "reader.example", origin },
    });
  expect(allowedWriteOrigin(make("https://reader.example"), false)).toBe(true);
  for (const origin of [
    "https://other.example",
    "http://reader.example",
    "https://reader.example:8443",
  ])
    expect(allowedWriteOrigin(make(origin), false)).toBe(false);
});
