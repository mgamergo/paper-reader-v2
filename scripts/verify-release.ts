import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  process.stdout.write(
    "Usage: bun scripts/verify-release.ts --phase source|browser [--base-url http://localhost:3000] [--plan]\nSource requires stopped Next and running local Convex. Browser requires the recorded production build. Neither phase starts or stops services.\n",
  );
  process.exit(0);
}
let phase: "source" | "browser" = "source";
let base = "http://localhost:3000";
let plan = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--plan") plan = true;
  else if (arg === "--phase")
    phase = z.enum(["source", "browser"]).parse(args[++i]);
  else if (arg === "--base-url") base = z.string().parse(args[++i]);
  else throw new Error("Unknown verification argument. See --help.");
}
function localUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Verification requires a plain loopback HTTP origin.");
  return url;
}
const baseUrl = localUrl(base);
const convexUrl = localUrl(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210",
);
for (const value of [
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  process.env.CONVEX_SITE_URL,
]) {
  if (value) localUrl(value);
}
const root = resolve(import.meta.dir, "..");
process.chdir(root);
const startedAt = new Date().toISOString();
const stamp = `${startedAt.replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`;
const directory = `.data/verification/${stamp}-${phase}`;
const commands =
  phase === "source"
    ? [
        ["bun", "run", "format:check"],
        ["bun", "run", "lint"],
        ["bun", "run", "typecheck"],
        ["bun", "run", "test"],
        ["bun", "run", "eval:rag"],
        ["bun", "run", "build"],
      ]
    : [
        [
          "bun",
          "run",
          "test:e2e",
          "--workers=1",
          `--output=${directory}/playwright`,
        ],
      ];
if (plan) {
  process.stdout.write(
    `${JSON.stringify({ phase, baseUrl: baseUrl.origin, convexUrl: convexUrl.origin, commands, serviceManagement: "external", output: directory }, null, 2)}\n`,
  );
  process.exit(0);
}

const active = new Set<number>();
let stopped = false;
let interruptDeadline: ReturnType<typeof setTimeout> | undefined;
function signalChildren(signal: NodeJS.Signals): void {
  for (const pid of active) {
    try {
      process.kill(-pid, signal);
    } catch (error) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "ESRCH"
      ))
        throw error;
    }
  }
}
function stop(): void {
  stopped = true;
  signalChildren("SIGTERM");
  interruptDeadline ??= setTimeout(() => signalChildren("SIGKILL"), 5000);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
async function metadata(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "ignore" });
  const result = await new Response(child.stdout).text();
  if ((await child.exited) !== 0)
    throw new Error("Git metadata could not be read.");
  return result.trim();
}
async function fingerprint(): Promise<string> {
  const child = Bun.spawn(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { stdout: "pipe", stderr: "ignore" },
  );
  const names = (await new Response(child.stdout).text())
    .split("\0")
    .filter(
      (name) =>
        /\.(?:ts|tsx|js|mjs|css|json|pdf|lock)$/.test(name) &&
        !name.startsWith("artifacts/"),
    )
    .sort();
  if ((await child.exited) !== 0)
    throw new Error("Source files could not be enumerated.");
  const hash = createHash("sha256");
  for (const name of names)
    hash
      .update(name)
      .update("\0")
      .update(await readFile(name))
      .update("\0");
  return hash.digest("hex");
}
async function ready(url: URL, deadlineMs = 30000): Promise<void> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline && !stopped) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2000),
        redirect: "error",
      });
      await response.body?.cancel();
      if (response.ok) return;
    } catch {}
    await Bun.sleep(250);
  }
  throw new Error(
    "A required local service did not become ready within 30 seconds.",
  );
}
async function stoppedNext(): Promise<void> {
  const socket = await Bun.connect({
    hostname: baseUrl.hostname === "[::1]" ? "::1" : baseUrl.hostname,
    port: Number(baseUrl.port || "80"),
    socket: {
      data() {},
      open(socket) {
        socket.end();
      },
      error() {},
      close() {},
    },
  }).catch(() => null);
  if (socket)
    throw new Error(
      "Next is already listening at the verification origin. Stop that owned server before source verification.",
    );
}
const results: {
  command: string[];
  exitCode: number;
  durationMs: number;
  log: string;
  timedOut: boolean;
}[] = [];
async function run(command: string[], index: number): Promise<void> {
  if (stopped) throw new Error("Verification was interrupted.");
  const log = `${directory}/${index + 1}-${command[2] ?? "command"}.log`;
  const handle = await open(log, "wx", 0o600);
  const started = Date.now();
  let timedOut = false;
  try {
    const child = spawn(command[0] ?? "bun", command.slice(1), {
      cwd: root,
      detached: true,
      stdio: ["ignore", handle.fd, handle.fd],
      env: {
        ...process.env,
        APP_MODE: "local",
        LLM_PROVIDER: "mock",
        INSTABOX_HEADLESS: "1",
        PLAYWRIGHT_BASE_URL: baseUrl.origin,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
    if (!child.pid) throw new Error("Verification subprocess did not start.");
    const pid = child.pid;
    active.add(pid);
    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-pid, "SIGTERM");
      } catch {}
    }, 300000);
    const forced = setTimeout(() => {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {}
    }, 310000);
    let exitCode: number;
    try {
      exitCode = await new Promise<number>((accept, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => accept(code ?? 1));
      });
    } finally {
      clearTimeout(timeout);
      clearTimeout(forced);
      try {
        process.kill(-pid, "SIGKILL");
      } catch {}
      active.delete(pid);
    }
    results.push({
      command,
      exitCode,
      durationMs: Date.now() - started,
      log,
      timedOut,
    });
    process.stdout.write(
      `${exitCode === 0 && !timedOut ? "PASS" : "FAIL"} ${command.join(" ")} (${Date.now() - started} ms); ${log}\n`,
    );
    if (exitCode !== 0 || timedOut)
      throw new Error("A verification command failed. Read its local log.");
  } finally {
    await handle.close();
  }
}

await mkdir(directory, { recursive: true, mode: 0o700 });
const sha = await metadata(["git", "rev-parse", "HEAD"]);
const sourceHash = await fingerprint();
let buildId: string | undefined;
let success = false;
let failure: string | undefined;
try {
  await ready(new URL("/version", convexUrl));
  if (phase === "source") await stoppedNext();
  else {
    const recorded = z
      .object({
        sha: z.string(),
        sourceHash: z.string(),
        buildId: z.string(),
        success: z.literal(true),
      })
      .parse(
        JSON.parse(await readFile(".data/verification-build.json", "utf8")),
      );
    buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
    if (recorded.sourceHash !== sourceHash || recorded.buildId !== buildId)
      throw new Error(
        "The production build does not match the recorded source verification. Rebuild through the source phase.",
      );
    await ready(baseUrl);
    const document = await fetch(baseUrl, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    const buildMarker = JSON.stringify(`"b":"${buildId}"`).slice(1, -1);
    if (!document.ok || !(await document.text()).includes(buildMarker))
      throw new Error(
        "The running Next document does not identify the verified production build.",
      );
    const servedManifest = await fetch(
      new URL(
        `/_next/static/${encodeURIComponent(buildId)}/_buildManifest.js`,
        baseUrl,
      ),
      { signal: AbortSignal.timeout(5000), redirect: "error" },
    );
    const expectedManifest = await readFile(
      `.next/static/${buildId}/_buildManifest.js`,
      "utf8",
    );
    if (
      !servedManifest.ok ||
      (await servedManifest.text()) !== expectedManifest
    )
      throw new Error(
        "The running Next process does not serve the verified production build.",
      );
  }
  for (const [index, command] of commands.entries()) await run(command, index);
  if (sourceHash !== (await fingerprint()))
    throw new Error(
      "Application sources changed during verification. Run again after all writers stop.",
    );
  if (phase === "source") {
    buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
    await writeFile(
      ".data/verification-build.json",
      `${JSON.stringify({ sha, sourceHash, buildId, success: true }, null, 2)}\n`,
      { mode: 0o600 },
    );
  }
  success = true;
} catch (error) {
  failure = error instanceof Error ? error.message : "Verification failed.";
  process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
} finally {
  signalChildren("SIGKILL");
  if (interruptDeadline) clearTimeout(interruptDeadline);
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  await writeFile(
    `${directory}/summary.json`,
    `${JSON.stringify({ phase, success, sha, sourceHash, buildId, boxInstanceId: process.env.BOX_INSTANCE_ID ?? null, startedAt, finishedAt: new Date().toISOString(), baseUrl: baseUrl.origin, convexUrl: convexUrl.origin, results, failure }, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`Verification summary: ${directory}/summary.json\n`);
}
