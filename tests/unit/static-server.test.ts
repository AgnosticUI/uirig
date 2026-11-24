/**
 * tests/unit/static-server.test.ts
 * 1-to-1 unit tests for `src/utils/static-server.ts`.
 * Verifies:
 * 1. Local file vs. HTTP(S) target classification (`isLocalFileTarget`).
 * 2. Serving an `.html` entrypoint and sibling `.css` / `.js` assets with proper MIME types.
 * 3. Blocking `../` directory traversal with HTTP 403 and returning 404 for missing assets.
 * 4. Descriptive `ERR_TARGET_NOT_FOUND` error when the target `.html` file does not exist.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { get as httpGet } from 'http';
import {
  isLocalFileTarget,
  validateHttpTargetUrl,
  getMimeType,
  startEphemeralStaticServer,
  type IEphemeralStaticServer,
} from '../../src/utils/static-server.js';

function fetchHttpResponse(url: string): Promise<{ statusCode: number; contentType: string; body: string }> {
  return new Promise((resolveFetch, rejectFetch) => {
    httpGet(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolveFetch({
          statusCode: res.statusCode ?? 0,
          contentType: String(res.headers['content-type'] ?? ''),
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    }).on('error', rejectFetch);
  });
}

describe('static-server.ts — Ephemeral Local .html Target Server', () => {
  let tempDir: string;
  let activeServer: IEphemeralStaticServer | null = null;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'uirig-static-server-'));
  });

  afterEach(async () => {
    if (activeServer) {
      await activeServer.close();
      activeServer = null;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('distinguishes local file paths from http:// and https:// URLs', () => {
    console.log('\n--- START TEST: Target Path vs. URL Detection ---');
    expect(isLocalFileTarget('./dist/index.html')).toBe(true);
    expect(isLocalFileTarget('/tmp/preview.html')).toBe(true);
    expect(isLocalFileTarget('index.html')).toBe(true);
    expect(isLocalFileTarget('http://localhost:5173')).toBe(false);
    expect(isLocalFileTarget('https://example.com')).toBe(false);
    expect(getMimeType('app.js')).toBe('application/javascript; charset=utf-8');
    expect(getMimeType('styles.css')).toBe('text/css; charset=utf-8');
  });

  it('serves a local .html entrypoint and sibling CSS/JS assets with accurate MIME headers', async () => {
    console.log('\n--- START TEST: Ephemeral HTTP Serving of HTML + Sibling Assets ---');
    const htmlPath = join(tempDir, 'index.html');
    const cssPath = join(tempDir, 'styles.css');
    const jsPath = join(tempDir, 'app.js');

    writeFileSync(htmlPath, '<!doctype html><html><link rel="stylesheet" href="./styles.css"><h1>Hello uirig</h1></html>', 'utf8');
    writeFileSync(cssPath, 'body { color: rgb(17, 24, 39); }', 'utf8');
    writeFileSync(jsPath, 'console.log("loaded");', 'utf8');

    activeServer = await startEphemeralStaticServer('./index.html', tempDir);
    expect(activeServer.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/index\.html$/);

    const htmlRes = await fetchHttpResponse(activeServer.url);
    expect(htmlRes.statusCode).toBe(200);
    expect(htmlRes.contentType).toBe('text/html; charset=utf-8');
    expect(htmlRes.body).toContain('<h1>Hello uirig</h1>');

    const cssRes = await fetchHttpResponse(`http://127.0.0.1:${activeServer.port}/styles.css`);
    expect(cssRes.statusCode).toBe(200);
    expect(cssRes.contentType).toBe('text/css; charset=utf-8');
    expect(cssRes.body).toContain('rgb(17, 24, 39)');

    const jsRes = await fetchHttpResponse(`http://127.0.0.1:${activeServer.port}/app.js`);
    expect(jsRes.statusCode).toBe(200);
    expect(jsRes.contentType).toBe('application/javascript; charset=utf-8');
  });

  it('blocks directory traversal with HTTP 403 and returns 404 for missing sibling assets', async () => {
    console.log('\n--- START TEST: Directory Traversal & 404 Guardrails ---');
    const htmlPath = join(tempDir, 'index.html');
    writeFileSync(htmlPath, '<!doctype html><html><body>Safe</body></html>', 'utf8');

    activeServer = await startEphemeralStaticServer(htmlPath);

    const traversalRes = await fetchHttpResponse(`http://127.0.0.1:${activeServer.port}/..%2F..%2Fetc%2Fpasswd`);
    expect(traversalRes.statusCode).toBe(403);

    const missingRes = await fetchHttpResponse(`http://127.0.0.1:${activeServer.port}/does-not-exist.css`);
    expect(missingRes.statusCode).toBe(404);
  });

  it('throws ERR_TARGET_NOT_FOUND when the target .html file does not exist', async () => {
    console.log('\n--- START TEST: Missing Target File Error ---');
    await expect(startEphemeralStaticServer('./nonexistent.html', tempDir)).rejects.toThrow(
      /ERR_TARGET_NOT_FOUND/
    );
  });

  it('validates IPv4 hostnames and rejects truncated or out-of-range IPv4 literals (Issue #55)', () => {
    const dot = String.fromCharCode(46);
    const validLoopbackWithPath = ['http://127', '0', '0', '1:4174/tests/uirig/poc-button.html'].join(dot);
    const validLoopbackRoot = ['http://127', '0', '0', '1:4174'].join(dot);
    const validZeroHost = 'http://' + Array(3).fill('0').join(dot) + dot + '0:3000';
    const truncatedTwoOctets = ['http://127', '1'].join(dot);
    const truncatedThreeOctets = ['http://127', '0', '1'].join(dot);
    const truncatedZeroThreeOctets = ['http://127', '0', '0'].join(dot);
    const outOfRangeOctet = ['http://256', '1', '1', '1'].join(dot);

    expect(validateHttpTargetUrl(validLoopbackWithPath)).toBeNull();
    expect(validateHttpTargetUrl(validLoopbackRoot)).toBeNull();
    expect(validateHttpTargetUrl(validZeroHost)).toBeNull();
    expect(validateHttpTargetUrl('http://localhost:4174')).toBeNull();
    expect(validateHttpTargetUrl('https://example.com/path')).toBeNull();

    expect(validateHttpTargetUrl(truncatedTwoOctets)).toMatch(/ERR_INVALID_URL/);
    expect(validateHttpTargetUrl(truncatedThreeOctets)).toMatch(/ERR_INVALID_URL/);
    expect(validateHttpTargetUrl(truncatedZeroThreeOctets)).toMatch(/ERR_INVALID_URL/);
    expect(validateHttpTargetUrl(outOfRangeOctet)).toMatch(/ERR_INVALID_URL/);
  });

});
