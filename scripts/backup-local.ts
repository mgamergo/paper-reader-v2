import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  process.stdout.write(
    "Usage: bun scripts/backup-local.ts [--plan]\nExports only the configured local Convex, including file storage, into private .data/backups. It never restores data.\n",
  );
  process.exit(0);
}
if (args.some((arg) => arg !== "--plan"))
  throw new Error("Unknown backup argument. See --help.");
process.chdir(resolve(import.meta.dir, ".."));
const config = z
  .object({
    ports: z.object({
      cloud: z.number().int().positive(),
      site: z.number().int().positive(),
    }),
    deploymentName: z.string().min(1),
    adminKey: z.string().min(1),
  })
  .parse(
    JSON.parse(await readFile(".convex/local/default/config.json", "utf8")),
  );
const url = new URL(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210",
);
if (
  url.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash ||
  Number(url.port || "80") !== config.ports.cloud
)
  throw new Error(
    "Backup requires the loopback URL and port from this project's local Convex configuration.",
  );
const stamp = `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`;
const directory = `.data/backups/${stamp}`;
const archive = `${directory}/snapshot.zip`;
const command = [
  "bunx",
  "convex",
  "export",
  "--env-file",
  `${directory}/cli.env`,
  "--include-file-storage",
  "--path",
  archive,
];
if (args.includes("--plan")) {
  process.stdout.write(
    `${JSON.stringify({ command, localUrl: url.origin, backupDirectory: directory, restore: false }, null, 2)}\n`,
  );
  process.exit(0);
}
const response = await fetch(new URL("/version", url), {
  signal: AbortSignal.timeout(5000),
  redirect: "error",
});
await response.body?.cancel();
if (!response.ok) throw new Error("The configured local Convex is not ready.");
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
async function run(command: string[], log: string): Promise<void> {
  const handle = await open(log, "wx", 0o600);
  try {
    const child = spawn(command[0] ?? "bunx", command.slice(1), {
      detached: true,
      stdio: ["ignore", handle.fd, handle.fd],
      env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
    });
    if (!child.pid) throw new Error("Backup subprocess did not start.");
    const pid = child.pid;
    const terminate = () => {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {}
    };
    const force = () => {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {}
    };
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      terminate();
    }, 180000);
    const kill = setTimeout(force, 190000);
    process.once("SIGINT", force);
    process.once("SIGTERM", force);
    try {
      const code = await new Promise<number>((accept, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => accept(code ?? 1));
      });
      if (code !== 0 || timedOut)
        throw new Error(`Backup step failed. Inspect ${log} locally.`);
    } finally {
      clearTimeout(timeout);
      clearTimeout(kill);
      process.removeListener("SIGINT", force);
      process.removeListener("SIGTERM", force);
      force();
    }
  } finally {
    await handle.close();
  }
}
const credentialFile = `${directory}/cli.env`;
await writeFile(
  credentialFile,
  `CONVEX_SELF_HOSTED_URL=${url.origin}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${config.adminKey}\n`,
  { mode: 0o600, flag: "wx" },
);
try {
  await run(command, `${directory}/export.log`);
} finally {
  await rm(credentialFile, { force: true });
}
await chmod(archive, 0o600);
await run(["unzip", "-tq", archive], `${directory}/integrity.log`);
const archiveHash = createHash("sha256");
for await (const bytes of Bun.file(archive).stream()) archiveHash.update(bytes);
const manifest = {
  createdAt: new Date().toISOString(),
  boxInstanceId: process.env.BOX_INSTANCE_ID ?? null,
  localUrl: url.origin,
  deploymentName: config.deploymentName,
  includesFileStorage: true,
  archive: "snapshot.zip",
  bytes: (await stat(archive)).size,
  sha256: archiveHash.digest("hex"),
  zipIntegrity: "passed",
  restoreTested: false,
};
await writeFile(
  `${directory}/manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
  { mode: 0o600 },
);
process.stdout.write(
  `Local backup complete: ${archive}\nManifest: ${directory}/manifest.json\nKeep the archive private. Copy it to an authorized durable location. Restore has not been tested.\n`,
);
