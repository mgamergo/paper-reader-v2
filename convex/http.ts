import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireOwner } from "./identity";
const http = httpRouter();
http.route({
  path: "/files",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let owner: string;
    try {
      owner = await requireOwner(ctx);
    } catch {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (Number(request.headers.get("content-length") ?? 0) > 25 * 1024 * 1024)
      return Response.json({ error: "PDF exceeds 25 MB" }, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ error: "PDF required" }, { status: 400 });
    const pieces: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 25 * 1024 * 1024) {
        await reader.cancel();
        return Response.json({ error: "PDF exceeds 25 MB" }, { status: 413 });
      }
      pieces.push(item.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const piece of pieces) {
      bytes.set(piece, offset);
      offset += piece.length;
    }
    if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
      return Response.json({ error: "Invalid PDF" }, { status: 400 });
    const storageId = await ctx.storage.store(
      new Blob([bytes], { type: "application/pdf" }),
    );
    await ctx.runMutation(internal.workspace.claimUpload, { owner, storageId });
    return Response.json({ storageId });
  }),
});
export default http;
