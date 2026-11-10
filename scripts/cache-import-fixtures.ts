import { fetchPublicResource } from "../lib/server/network";
import {
  writeImportFixture,
  readImportFixture,
} from "../lib/server/import-cache";
const directory = process.argv[2] ?? ".data/import-fixtures";
delete process.env.IMPORT_FIXTURE_CACHE_DIR;
const ids = process.argv.slice(3);
if (!ids.length) ids.push("1706.03762");
for (const id of ids) {
  if (!/^\d{4}\.\d{4,5}(?:v\d+)?$/.test(id))
    throw new Error("Fixture paper IDs must be arXiv identifiers");
  for (const url of [
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
    `https://arxiv.org/pdf/${id}`,
  ]) {
    try {
      await readImportFixture(directory, url, 25 * 1024 * 1024);
      process.stdout.write(`Verified cached public source ${url}\n`);
      continue;
    } catch {}
    let resource: Awaited<ReturnType<typeof fetchPublicResource>> | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        resource = await fetchPublicResource(url, { timeoutMs: 30000 });
        break;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
    if (!resource) throw new Error("Public fixture download failed");
    await writeImportFixture(directory, resource, url);
    process.stdout.write(`Cached public source ${url}\n`);
  }
}
