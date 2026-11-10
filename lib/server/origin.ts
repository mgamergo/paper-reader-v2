const loopbacks = new Set(["localhost", "127.0.0.1", "[::1]"]);
export function isLoopback(url: URL): boolean {
  return loopbacks.has(url.hostname);
}
export function allowedWriteOrigin(request: Request, local: boolean): boolean {
  const origin = request.headers.get("origin");
  if (!origin || ["GET", "HEAD"].includes(request.method)) return true;
  try {
    const actual = new URL(request.url);
    const supplied = new URL(origin);
    return (
      supplied.origin === actual.origin ||
      (local &&
        isLoopback(actual) &&
        isLoopback(supplied) &&
        supplied.protocol === actual.protocol &&
        supplied.port === actual.port)
    );
  } catch {
    return false;
  }
}
