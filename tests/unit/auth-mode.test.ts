import { expect, test } from "bun:test";
import { workspaceAuthMode } from "../../lib/server/auth-mode";
test("only explicit local mode bypasses hosted account requirements", () => {
  expect(workspaceAuthMode({ mode: "local" })).toBe("local");
  expect(
    workspaceAuthMode({
      mode: "local",
      publishableKey: "public-fixture",
      secretKey: "private-fixture",
    }),
  ).toBe("local");
  for (const mode of [undefined, "production", "unknown"]) {
    expect(workspaceAuthMode({ mode })).toBe("unavailable");
    expect(workspaceAuthMode({ mode, publishableKey: "public-fixture" })).toBe(
      "unavailable",
    );
    expect(workspaceAuthMode({ mode, secretKey: "private-fixture" })).toBe(
      "unavailable",
    );
    expect(
      workspaceAuthMode({
        mode,
        publishableKey: "public-fixture",
        secretKey: "private-fixture",
      }),
    ).toBe("clerk");
  }
});
