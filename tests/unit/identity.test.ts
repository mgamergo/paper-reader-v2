import { afterEach, expect, test } from "bun:test";
import type { Auth } from "convex/server";
import { requireOwner } from "../../convex/identity";
const previous = process.env.ALLOW_LOCAL_AUTH;
afterEach(() => {
  if (previous === undefined) delete process.env.ALLOW_LOCAL_AUTH;
  else process.env.ALLOW_LOCAL_AUTH = previous;
});
const anonymous: Auth = { getUserIdentity: async () => null };
test("anonymous production access fails closed", async () => {
  delete process.env.ALLOW_LOCAL_AUTH;
  await expect(requireOwner({ auth: anonymous })).rejects.toThrow(
    "Authentication required",
  );
});
test("development fallback requires explicit opt-in", async () => {
  process.env.ALLOW_LOCAL_AUTH = "false";
  await expect(requireOwner({ auth: anonymous })).rejects.toThrow();
  process.env.ALLOW_LOCAL_AUTH = "true";
  expect(await requireOwner({ auth: anonymous })).toBe("local-workspace");
});
test("authenticated identity wins over local fallback", async () => {
  process.env.ALLOW_LOCAL_AUTH = "true";
  const auth: Auth = {
    getUserIdentity: async () => ({
      subject: "user_1",
      issuer: "https://clerk.example",
      tokenIdentifier: "https://clerk.example|user_1",
    }),
  };
  expect(await requireOwner({ auth })).toBe("https://clerk.example|user_1");
});
