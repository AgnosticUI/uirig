/**
 * src/utils/static-server.ts
 * Ephemeral local HTTP server for auditing standalone `.html` files.
 * Spins up an isolated `127.0.0.1:0` server rooted at the target file's parent
 * directory so relative CSS/JS/media assets resolve over real HTTP without
 * `file://` CORS restrictions, and tears down cleanly when closed.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { existsSync, readFileSync, statSync } from 'fs';
import { basename, dirname, extname, resolve, sep } from 'path';
import { logTelemetry } from './formatter.js';

export interface IEphemeralStaticServer {
  url: string;
  rootDir: string;
  port: number;
  close: () => Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const INCOMPLETE_IPV4_REGEX = /^\d{1,3}(?:\.\d{1,3}){0,2}$/;
const FULL_IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Determines whether a target string represents a local file path rather than an HTTP(S) URL.
 */
export function isLocalFileTarget(target: string): boolean {
  return !/^https?:\/\//i.test(target.trim());
}

/**
 * Validates an `http://` or `https://` target URL string.
 * Returns `null` when valid, or an actionable `ERR_INVALID_URL` reason string when malformed
 * (e.g., truncated 3-octet IPv4 addresses or out-of-range octets).
 */
export function validateHttpTargetUrl(rawTarget: string): string | null {
  const trimmed = rawTarget.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  const authorityMatch = /^https?:\/\/([^/?#]+)/i.exec(trimmed);
  const rawAuthority = authorityMatch?.at(1) ?? '';
  const withoutUserInfo = rawAuthority.includes('@')
    ? rawAuthority.slice(rawAuthority.lastIndexOf('@') + 1)
    : rawAuthority;
  const rawHost = withoutUserInfo.startsWith('[')
    ? withoutUserInfo
    : (withoutUserInfo.split(':').at(0) ?? '');

  if (!rawHost) {
    return `ERR_INVALID_URL: Missing hostname in target URL '${trimmed}'.`;
  }
  if (INCOMPLETE_IPV4_REGEX.test(rawHost)) {
    return (
      `ERR_INVALID_URL: Truncated IPv4 address '${rawHost}' in target URL '${trimmed}'. ` +
      `Expected 4 octets (for example: http://localhost:4174/index.html or a 4-octet IPv4 loopback address).`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return `ERR_INVALID_URL: Malformed target URL '${trimmed}'. Verify the full host, port, and path.`;
  }

  const host = parsed.hostname;
  if (!host) {
    return `ERR_INVALID_URL: Missing hostname in target URL '${trimmed}'.`;
  }

  const fullIpv4Match = FULL_IPV4_REGEX.exec(host);
  if (fullIpv4Match) {
    const [, o1 = '', o2 = '', o3 = '', o4 = ''] = fullIpv4Match;
    const octets = [Number(o1), Number(o2), Number(o3), Number(o4)];
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return `ERR_INVALID_URL: Invalid IPv4 address '${host}' in target URL '${trimmed}'. Each octet must be between 0 and 255.`;
    }
  }

  return null;
}

/**
 * Resolves a safe MIME type header from a file extension.
 */
export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Starts an ephemeral `127.0.0.1` HTTP server rooted at the parent directory of `htmlFilePath`.
 * Returns the full `http://127.0.0.1:<port>/<filename>` target URL and a deterministic `close()` hook.
 */
export async function startEphemeralStaticServer(
  htmlFilePath: string,
  cwd: string = process.cwd()
): Promise<IEphemeralStaticServer> {
  const resolvedEntryFile = resolve(cwd, htmlFilePath);

  if (!existsSync(resolvedEntryFile) || !statSync(resolvedEntryFile).isFile()) {
    throw new Error(`ERR_TARGET_NOT_FOUND: Local target file does not exist: ${resolvedEntryFile}`);
  }

  const rootDir = dirname(resolvedEntryFile);
  const entryFileName = basename(resolvedEntryFile);

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const rawUrl = req.url ?? '/';
    const cleanPathname = decodeURIComponent(rawUrl.split('?')[0] ?? '/');
    const relativeRequestPath = cleanPathname === '/' ? entryFileName : cleanPathname.replace(/^\/+/, '');
    const resolvedAssetPath = resolve(rootDir, relativeRequestPath);

    // Prevent directory traversal outside the target file's parent folder
    const normalizedRoot = rootDir.endsWith(sep) ? rootDir : `${rootDir}${sep}`;
    if (resolvedAssetPath !== rootDir && !resolvedAssetPath.startsWith(normalizedRoot)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    if (!existsSync(resolvedAssetPath) || !statSync(resolvedAssetPath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    try {
      const content = readFileSync(resolvedAssetPath);
      res.writeHead(200, {
        'Content-Type': getMimeType(resolvedAssetPath),
        'Cache-Control': 'no-store',
      });
      res.end(content);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error');
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const url = `http://127.0.0.1:${port}/${encodeURIComponent(entryFileName)}`;

  logTelemetry('server:start', `Serving local target ${resolvedEntryFile} at ${url}`);

  return {
    url,
    rootDir,
    port,
    close: () =>
      new Promise<void>((resolveClose) => {
        server.close(() => {
          logTelemetry('server:stop', `Closed ephemeral static server on port ${port}`);
          resolveClose();
        });
      }),
  };
}
