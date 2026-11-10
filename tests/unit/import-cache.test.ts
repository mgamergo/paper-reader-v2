import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readImportFixture,
  writeImportFixture,
  cacheKey,
} from "../../lib/server/import-cache";
import { readRequestBytes, readJsonBody } from "../../lib/server/network";
test("offline imports replay exact public bytes and reject corrupt or oversized fixtures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "reader-import-"));
  const url = "https://arxiv.org/pdf/1706.03762";
  const bytes = new TextEncoder().encode("%PDF-1.7\nfixture bytes");
  try {
    await writeImportFixture(directory, {
      url,
      bytes,
      contentType: "application/pdf",
    });
    expect((await readImportFixture(directory, url, 1024)).bytes).toEqual(
      bytes,
    );
    await expect(readImportFixture(directory, url, 2)).rejects.toThrow(
      "integrity",
    );
    await writeFile(join(directory, `${cacheKey(url)}.bin`), "tampered");
    await expect(readImportFixture(directory, url, 1024)).rejects.toThrow(
      "integrity",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("streamed request limits apply even without content-length", async () => {
  const request = new Request("http://127.0.0.1/api/import", {
    method: "POST",
    body: new Uint8Array(20),
  });
  await expect(readRequestBytes(request, 10)).rejects.toThrow("size limit");
  const parsed = await readJsonBody(
    new Request("http://127.0.0.1/api/settings", {
      method: "PATCH",
      body: '{"theme":"sepia"}',
    }),
  );
  expect(parsed).toEqual({ theme: "sepia" });
});
