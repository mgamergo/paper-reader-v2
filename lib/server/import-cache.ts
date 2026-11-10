import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
const entrySchema = z.object({
  url: z.string().url(),
  contentType: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}
export async function readImportFixture(
  directory: string,
  url: string,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; contentType: string; url: string }> {
  const key = cacheKey(url);
  const metadata = entrySchema.parse(
    JSON.parse(await readFile(join(directory, `${key}.json`), "utf8")),
  );
  if (metadata.url !== url) throw new Error("Import fixture URL mismatch");
  const bytes = new Uint8Array(await readFile(join(directory, `${key}.bin`)));
  if (
    bytes.byteLength > maxBytes ||
    createHash("sha256").update(bytes).digest("hex") !== metadata.sha256
  )
    throw new Error("Import fixture integrity mismatch");
  return { bytes, contentType: metadata.contentType, url };
}
export async function writeImportFixture(
  directory: string,
  resource: { url: string; bytes: Uint8Array; contentType: string },
  requestUrl = resource.url,
): Promise<void> {
  await mkdir(directory, { recursive: true });
  const key = cacheKey(requestUrl);
  await writeFile(join(directory, `${key}.bin`), resource.bytes);
  await writeFile(
    join(directory, `${key}.json`),
    JSON.stringify(
      {
        url: requestUrl,
        contentType: resource.contentType,
        sha256: createHash("sha256").update(resource.bytes).digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
}
