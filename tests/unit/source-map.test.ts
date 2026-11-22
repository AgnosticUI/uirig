/**
 * tests/unit/source-map.test.ts
 * Unit & live Chromium CDP (Chrome DevTools Protocol) specs for Framework Source-Map
 * & `file:line` Attribution (Issue #9).
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  parseDevSourceLocationAttribute,
  parseRawSourceMap,
  resolveOriginalPositionFromSourceMap,
  type IRawSourceMapV3,
} from '../../src/core/source-map.js';
import { executeCheckCommand } from '../../src/commands/check.js';
import { formatAgenticJsonStream, type IAgenticJsonStreamPayload } from '../../src/utils/agent-stream.js';

describe('::: ISSUE #9 (CHUNKS 1–2): FRAMEWORK SOURCE-MAP & FILE:LINE ATTRIBUTION :::', () => {
  it('==> Should decode inline Base64 data-URI source maps and resolve 1-based file:line:column', () => {
    const sampleMap: IRawSourceMapV3 = {
      version: 3,
      sources: ['../src/styles/card.scss'],
      sourceRoot: '/workspace/app/dist',
      mappings: 'AAWI',
    };
    const encoded = Buffer.from(JSON.stringify(sampleMap), 'utf8').toString('base64');
    const dataUri = 'data:application/json;charset=utf-8;base64,' + encoded;

    const parsed = parseRawSourceMap(dataUri);
    expect(parsed).not.toBeNull();

    const resolved = resolveOriginalPositionFromSourceMap(
      parsed as IRawSourceMapV3,
      0,
      2,
      '/workspace/app'
    );
    expect(resolved).toEqual({
      sourceFile: 'src/styles/card.scss',
      lineNumber: 12,
      columnNumber: 5,
    });
  });

  it('==> Should parse framework dev-mode data-source-loc attributes and handle unmapped/corrupt inputs safely', () => {
    expect(
      parseDevSourceLocationAttribute('/workspace/app/src/components/TicketCard.tsx:48:12', '/workspace/app')
    ).toEqual({
      sourceFile: 'src/components/TicketCard.tsx',
      lineNumber: 48,
      columnNumber: 12,
    });

    expect(parseDevSourceLocationAttribute('src/App.svelte:19', '/workspace/app')).toEqual({
      sourceFile: 'src/App.svelte',
      lineNumber: 19,
      columnNumber: 1,
    });

    expect(parseRawSourceMap('not-valid-json')).toBeNull();
    expect(parseRawSourceMap('data:application/json;base64,%%%invalid%%%')).toBeNull();
    expect(parseDevSourceLocationAttribute(null, '/workspace/app')).toBeNull();
  });

  it('==> Should resolve live CDP inline CSS source maps to file:line in check --json and fall back to null when unmapped', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-sourcemap-e2e-'));
    try {
      mkdirSync(join(tempDir, 'src', 'styles'), { recursive: true });
      const rawMap: IRawSourceMapV3 = {
        version: 3,
        sources: ['src/styles/banner.scss'],
        mappings: 'AAOE',
      };
      const base64Map = Buffer.from(JSON.stringify(rawMap), 'utf8').toString('base64');

      const htmlPath = join(tempDir, 'index.html');
      writeFileSync(
        htmlPath,
        `<!DOCTYPE html>
        <html>
          <head>
            <style>.low-contrast-banner { background: #ffffff; color: #e2e8f0; }
/*# sourceMappingURL=data:application/json;base64,${base64Map} */</style>
          </head>
          <body>
            <p id="mapped-banner" class="low-contrast-banner">Mapped warning</p>
            <span id="unmapped-text" style="background: #ffffff; color: #e2e8f0;">Inline unmapped warning</span>
          </body>
        </html>`,
        'utf8'
      );

      const report = await executeCheckCommand({
        target: './index.html',
        cwd: tempDir,
        only: 'contrast',
        viewportsOverride: [{ name: 'desktop', width: 1280, height: 800 }],
        headless: true,
        silentStdout: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      });

      expect(report.exitCode).toBe(1);
      const payload = JSON.parse(formatAgenticJsonStream(report)) as IAgenticJsonStreamPayload;
      expect(payload.violations).toHaveLength(2);

      const mapped = payload.violations.find((v) => v.selector.includes('p#mapped-banner'));
      expect(mapped?.sourceFile).toBe('src/styles/banner.scss');
      expect(mapped?.lineNumber).toBe(8);
      expect(mapped?.columnNumber).toBe(3);
      expect(mapped?.remediationAdvice).toContain('(source: src/styles/banner.scss:8)');

      const unmapped = payload.violations.find((v) => v.selector.includes('span#unmapped-text'));
      expect(unmapped?.sourceFile).toBeNull();
      expect(unmapped?.lineNumber).toBeNull();
      expect(unmapped?.columnNumber).toBeNull();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
