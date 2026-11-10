import { describe, expect, test } from "bun:test";
import {
  isPublicAddress,
  validatePublicUrl,
  fetchPublicResource,
} from "../../lib/server/network";
import { parseImportSource } from "../../lib/server/metadata";
describe("public document import boundary", () => {
  test.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.1.2",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("rejects private address %s", (ip) =>
    expect(isPublicAddress(ip)).toBe(false),
  );
  test.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "accepts public address %s",
    (ip) => expect(isPublicAddress(ip)).toBe(true),
  );
  test.each([
    "file:///etc/passwd",
    "http://localhost/a.pdf",
    "http://127.1/a.pdf",
    "http://0x7f000001/a.pdf",
    "http://[::1]/a.pdf",
    "https://user:password@example.com/a.pdf",
    "https://example.com:8443/a.pdf",
  ])("rejects forbidden URL %s", (source) =>
    expect(() => validatePublicUrl(source)).toThrow(),
  );
  test("cannot fetch a private resource", async () => {
    await expect(fetchPublicResource("http://127.0.0.1/a.pdf")).rejects.toThrow(
      "private",
    );
  });
  test("distinguishes DOI, arXiv, legacy arXiv, and URLs", () => {
    expect(parseImportSource("https://doi.org/10.1000/example")).toEqual({
      kind: "doi",
      id: "10.1000/example",
    });
    expect(parseImportSource("arXiv:1706.03762v7")).toEqual({
      kind: "arxiv",
      id: "1706.03762v7",
    });
    expect(parseImportSource("https://arxiv.org/pdf/1706.03762.pdf")).toEqual({
      kind: "arxiv",
      id: "1706.03762",
    });
    expect(parseImportSource("hep-th/9901001")).toEqual({
      kind: "arxiv",
      id: "hep-th/9901001",
    });
    expect(parseImportSource("https://example.com/paper.pdf")).toEqual({
      kind: "url",
      url: "https://example.com/paper.pdf",
    });
  });
});

test("rejects reserved documentation networks and link-local encodings", () => {
  for (const address of [
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "2001:db8::1",
    "::ffff:7f00:1",
  ])
    expect(isPublicAddress(address)).toBe(false);
});
