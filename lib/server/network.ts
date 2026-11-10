import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { readImportFixture } from "./import-cache";
import http from "node:http";
import https from "node:https";
export class ImportError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ImportError";
  }
}
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.process(address);
  if (parsed.range() !== "unicast") return false;
  return parsed.kind() === "ipv4" || /^[23]/.test(parsed.toString());
}
export function validatePublicUrl(source: string): URL {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new ImportError("Enter a valid public HTTP or HTTPS URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new ImportError(
      "Only public HTTP(S) URLs on standard ports are supported.",
    );
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    (isIP(host) && !isPublicAddress(host))
  )
    throw new ImportError("Local and private network URLs are not allowed.");
  return url;
}
export interface PublicResource {
  bytes: Uint8Array;
  contentType: string;
  url: string;
}
export async function fetchPublicResource(
  source: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    accept?: string;
    headers?: Record<string, string>;
  } = {},
  redirects = 0,
): Promise<PublicResource> {
  if (redirects > 4)
    throw new ImportError("The source redirected too many times.");
  const url = validatePublicUrl(source);
  if (process.env.IMPORT_FIXTURE_CACHE_DIR) {
    if (process.env.APP_MODE !== "local")
      throw new ImportError(
        "Import fixtures are restricted to local development.",
        503,
      );
    try {
      return await readImportFixture(
        process.env.IMPORT_FIXTURE_CACHE_DIR,
        url.href,
        options.maxBytes ?? 25 * 1024 * 1024,
      );
    } catch {
      throw new ImportError(
        "This public source is not in the offline import fixture cache. Prepare fixtures or disable IMPORT_FIXTURE_CACHE_DIR.",
        503,
      );
    }
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true }).catch(() => {
        throw new ImportError(
          "The source hostname could not be resolved.",
          502,
        );
      });
  if (
    !addresses.length ||
    addresses.some((entry) => !isPublicAddress(entry.address))
  )
    throw new ImportError(
      "The source resolves to a private or unsupported network address.",
    );
  const target = addresses[0];
  if (!target) throw new ImportError("No public source address is available.");
  const maxBytes = options.maxBytes ?? 25 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 20000;
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    const request = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: "GET",
        family: target.family,
        headers: {
          "User-Agent":
            "PaperReaderV2/0.1 (+research reader; metadata requests)",
          Accept:
            options.accept ??
            "application/pdf, application/octet-stream;q=0.9, */*;q=0.5",
          ...options.headers,
        },
        lookup: (_host, _options, callback) => {
          callback(null, target.address, target.family);
        },
      },
      (response) => {
        const status = response.statusCode ?? 502;
        if (
          [301, 302, 303, 307, 308].includes(status) &&
          response.headers.location
        ) {
          response.resume();
          settled = true;
          fetchPublicResource(
            new URL(response.headers.location, url).href,
            options,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          done(
            new ImportError(
              `The source returned HTTP ${status}. Check the identifier or use a PDF upload.`,
              502,
            ),
          );
          return;
        }
        const contentLength = Number(response.headers["content-length"] ?? 0);
        if (contentLength > maxBytes) {
          response.destroy();
          done(
            new ImportError(
              `The source exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB size limit.`,
              413,
            ),
          );
          return;
        }
        const parts: Buffer[] = [];
        let size = 0;
        response.on("data", (part: Buffer) => {
          size += part.length;
          if (size > maxBytes) {
            response.destroy();
            done(
              new ImportError(
                "The downloaded document exceeds the size limit.",
                413,
              ),
            );
            return;
          }
          parts.push(part);
        });
        response.on("error", (error) => done(error));
        response.on("end", () => {
          if (!settled) {
            settled = true;
            resolve({
              bytes: Buffer.concat(parts),
              contentType: String(response.headers["content-type"] ?? ""),
              url: url.href,
            });
          }
        });
      },
    );
    const timer = setTimeout(
      () =>
        request.destroy(
          new ImportError(
            "The source took too long to respond. Try uploading the PDF.",
            504,
          ),
        ),
      timeoutMs,
    );
    request.on("close", () => clearTimeout(timer));
    request.on("error", (error) => done(error));
    request.end();
  });
}
export async function readRequestBytes(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes)
    throw new ImportError("The request exceeds the size limit.", 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ImportError("The request exceeds the size limit.", 413);
    }
    parts.push(item.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
export async function readJsonBody(request: Request): Promise<unknown> {
  return JSON.parse(
    new TextDecoder().decode(await readRequestBytes(request, 2 * 1024 * 1024)),
  );
}
