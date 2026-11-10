import type { Auth } from "convex/server";
import { ConvexError } from "convex/values";
export async function requireOwner(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) return identity.tokenIdentifier;
  if (process.env.ALLOW_LOCAL_AUTH === "true") return "local-workspace";
  throw new ConvexError("Authentication required");
}
