import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { test, expect } from "./fixtures";

test("local account entry routes return to the real library without Clerk keys", async ({
  page,
}) => {
  for (const path of ["/sign-in", "/sign-up"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Local research workspace" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Open your library", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your library", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".paper-row")).toHaveCount(1);
  }
});

test("hosted mode without keys renders an accessible unavailable state and denies library data", async ({
  page,
  request,
}) => {
  const port = 3001,
    origin = `http://127.0.0.1:${port}`;
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () =>
      probe.close((error) => (error ? reject(error) : resolve())),
    );
  });
  const server = spawn("bun", ["run", "start", "--port", String(port)], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      APP_MODE: "production",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
    },
  });
  let startupError: Error | undefined;
  server.on("error", (error) => {
    startupError = error;
  });
  try {
    if (!server.pid) throw new Error("Hosted-mode test server did not start");
    let ready = false;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (startupError || server.exitCode !== null)
        throw new Error("Hosted-mode test server exited before readiness");
      try {
        const response = await fetch(origin, {
          signal: AbortSignal.timeout(1000),
        });
        await response.body?.cancel();
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(200);
    }
    expect(ready).toBe(true);
    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(origin);
      await expect(
        page.getByRole("heading", {
          name: "Sign in is unavailable",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Retry", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".workspace")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/acceptance-auth-unavailable-${viewport.name}.png`,
      });
    }
    for (const path of ["/sign-in", "/sign-up"]) {
      await page.goto(`${origin}${path}`);
      await expect(
        page.getByRole("heading", {
          name: "Sign in is unavailable",
          exact: true,
        }),
      ).toBeVisible();
    }
    const denied = await request.get(`${origin}/api/library`);
    expect(denied.status()).toBe(503);
    expect(await denied.json()).toEqual({
      error: "Authentication is not configured.",
    });
  } finally {
    if (server.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
      for (let i = 0; i < 20 && server.exitCode === null; i++) await delay(50);
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
  }
});
