import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { ImportError } from "./network";
import { RagError } from "../rag";
import { allowedWriteOrigin, localRequestAllowed } from "./origin";
export async function requestClient(
  request: Request,
): Promise<{ client: ConvexHttpClient; token: string | null }> {
  const local = process.env.APP_MODE === "local";
  if (local && !localRequestAllowed(request))
    throw new ImportError(
      "Local workspace mode is restricted to loopback. Configure Clerk for hosted access.",
      403,
    );
  if (!allowedWriteOrigin(request, local))
    throw new ImportError("Cross-origin writes are not allowed.", 403);
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url)
    throw new ImportError(
      "Convex is not configured. Start the local backend and set NEXT_PUBLIC_CONVEX_URL.",
      503,
    );
  const client = new ConvexHttpClient(url);
  let token: string | null = null;
  if (!local) {
    if (
      !process.env.CLERK_SECRET_KEY ||
      !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    )
      throw new ImportError("Authentication is not configured.", 503);
    const session = await auth();
    if (!session.userId)
      throw new ImportError("Sign in to open your research library.", 401);
    token = await session.getToken({ template: "convex" });
    if (!token)
      throw new ImportError("The Clerk Convex JWT template is missing.", 401);
    client.setAuth(token);
  }
  return { client, token };
}
export function apiError(error: unknown): Response {
  if (error instanceof RagError)
    return Response.json(
      { error: error.message },
      {
        status:
          error.code === "configuration"
            ? 503
            : error.code === "provider"
              ? 502
              : error.code === "limit"
                ? 413
                : 400,
      },
    );
  if (error instanceof ImportError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: error.issues
          .slice(0, 3)
          .map(
            (issue) => `${issue.path.join(".") || "Request"}: ${issue.message}`,
          )
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "The request contains invalid JSON." },
      { status: 400 },
    );
  const message = error instanceof Error ? error.message : "";
  if (/Authentication required/.test(message))
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (
    /Paper not found|Collection not found|Glossary term not found/.test(message)
  )
    return Response.json(
      { error: "This item was not found in your library." },
      { status: 404 },
    );
  if (/ECONNREFUSED|fetch failed|Failed to fetch/.test(message))
    return Response.json(
      { error: "The local backend is unavailable. Start Convex and retry." },
      { status: 503 },
    );
  return Response.json(
    {
      error:
        "The request could not be completed. Retry or check the server configuration.",
    },
    { status: 500 },
  );
}
