const loopbacks = new Set(["localhost", "127.0.0.1", "[::1]"]);
export function isLoopback(url: URL): boolean {
  return loopbacks.has(url.hostname);
}
export function localRequestAllowed(request: Request): boolean {
  try {
    const actual = new URL(request.url);
    const host = request.headers.get("host");
    if (
      !host ||
      !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)
    )
      return false;
    const authority = new URL(`${actual.protocol}//${host}`);
    return (
      isLoopback(actual) &&
      isLoopback(authority) &&
      actual.port === authority.port &&
      !authority.username &&
      !authority.password
    );
  } catch {
    return false;
  }
}
export function allowedWriteOrigin(request: Request, local: boolean): boolean {
  const origin = request.headers.get("origin");
  if (!origin || ["GET", "HEAD"].includes(request.method)) return true;
  try {
    const actual = new URL(request.url);
    const host = request.headers.get("host");
    if (host) {
      if (/[\s\/@#?,]/.test(host)) return false;
      actual.host = host;
    }
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
