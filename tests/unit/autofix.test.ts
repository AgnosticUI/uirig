/**
 * tests/unit/autofix.test.ts
 * Unit & live Chromium specs for Deterministic Auto-Fix Patch Generation (`unifiedDiff`)
 * and Safe Disk Application + Re-Verification (`--fix`) (Issue #13).
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  applyDeterministicAutoFixes,
  computeDeterministicAutoFix,
  type IDeterministicAutoFix,
} from '../../src/core/autofix.js';
import { executeCheckCommand } from '../../src/commands/check.js';
import { formatAgenticJsonStream, type IAgenticJsonStreamPayload } from '../../src/utils/agent-stream.js';
import { parseCliArgs } from '../../src/index.js';

describe('::: ISSUE #13 (CHUNKS 1–2): DETERMINISTIC AUTO-FIX UNIFIED DIFF & --FIX LOOP :::', () => {
  it('==> Should generate valid unifiedDiff patches for unambiguous token_drift, broken_image, and unsafe_uri violations', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-autofix-unit-'));
    try {
      mkdirSync(join(tempDir, 'src', 'components'), { recursive: true });
      const cssFile = join(tempDir, 'src', 'components', 'card.css');
      writeFileSync(
        cssFile,
        [
          '.card {',
          '  color: #3b82f6;',
          '  padding: 16px;',
          '}',
        ].join('\n'),
        'utf8'
      );

      const htmlFile = join(tempDir, 'src', 'components', 'card.html');
      writeFileSync(
        htmlFile,
        [
          '<div class="card">',
          '  <img src="/logo.png" width="32" height="32">',
          '  <a href="javascript:void(0)">Reset</a>',
          '</div>',
        ].join('\n'),
        'utf8'
      );

      const tokenFix = computeDeterministicAutoFix(
        {
          engine: 'tokens',
          violationType: 'token_drift',
          sourceFile: 'src/components/card.css',
          lineNumber: 2,
          measuredDelta: 'color: #3b82f6',
          suggestedToken: '--ag-color-primary',
        },
        tempDir
      );

      expect(tokenFix).not.toBeNull();
      expect(tokenFix?.unifiedDiff).toBe(
        [
          '--- a/src/components/card.css',
          '+++ b/src/components/card.css',
          '@@ -2,1 +2,1 @@',
          '-  color: #3b82f6;',
          '+  color: var(--ag-color-primary);',
        ].join('\n')
      );

      const imgFix = computeDeterministicAutoFix(
        {
          engine: 'dom',
          violationType: 'broken_image',
          sourceFile: 'src/components/card.html',
          lineNumber: 2,
          measuredDelta: '<img> missing alt attribute',
        },
        tempDir
      );
      expect(imgFix?.updatedLine).toBe('  <img alt="" src="/logo.png" width="32" height="32">');

      const uriFix = computeDeterministicAutoFix(
        {
          engine: 'dom',
          violationType: 'unsafe_uri',
          sourceFile: 'src/components/card.html',
          lineNumber: 3,
          measuredDelta: 'href="javascript:void(0)"',
        },
        tempDir
      );
      expect(uriFix?.updatedLine).toBe('  <a href="#">Reset</a>');

      const applied = applyDeterministicAutoFixes(
        [tokenFix, imgFix, uriFix].filter((f): f is IDeterministicAutoFix => f !== null),
        tempDir
      );
      expect(applied).toHaveLength(3);
      expect(readFileSync(cssFile, 'utf8')).toContain('color: var(--ag-color-primary);');
      expect(readFileSync(htmlFile, 'utf8')).toContain('<img alt="" src="/logo.png"');
      expect(readFileSync(htmlFile, 'utf8')).toContain('<a href="#">Reset</a>');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('==> Should refuse structural/layout engines, ambiguous multi-match lines, and out-of-workspace paths', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-autofix-guardrails-'));
    try {
      const cssFile = join(tempDir, 'ambiguous.css');
      writeFileSync(
        cssFile,
        '.box { color: #3b82f6; border-color: #3b82f6; }\n',
        'utf8'
      );

      expect(
        computeDeterministicAutoFix(
          {
            engine: 'stress',
            violationType: 'container_overflow',
            sourceFile: 'ambiguous.css',
            lineNumber: 1,
            measuredDelta: '+18px',
            suggestedToken: '--ag-space-4',
          },
          tempDir
        )
      ).toBeNull();

      expect(
        computeDeterministicAutoFix(
          {
            engine: 'tokens',
            violationType: 'token_drift',
            sourceFile: 'ambiguous.css',
            lineNumber: 1,
            measuredDelta: 'color: #3b82f6',
            suggestedToken: '--ag-color-primary',
          },
          tempDir
        )
      ).toBeNull();

      expect(
        computeDeterministicAutoFix(
          {
            engine: 'tokens',
            violationType: 'token_drift',
            sourceFile: '../outside.css',
            lineNumber: 1,
            measuredDelta: 'color: #3b82f6',
            suggestedToken: '--ag-color-primary',
          },
          tempDir
        )
      ).toBeNull();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('==> Should emit unifiedDiff in --json without touching disk, then apply patch and converge to exitCode 0 when --fix is passed', async () => {
    const parsedCli = parseCliArgs(['check', '--fix', '--json']);
    expect(parsedCli.command === 'check' && parsedCli.fix).toBe(true);

    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-autofix-e2e-'));
    try {
      const htmlPath = join(tempDir, 'index.html');
      writeFileSync(
        htmlPath,
        [
          '<!DOCTYPE html>',
          '<html>',
          '  <body>',
          '    <a id="bad-link" data-source-loc="index.html:4:5" href="javascript:void(0)">Click</a>',
          '  </body>',
          '</html>',
        ].join('\n'),
        'utf8'
      );

      // 1. Read-only check (`fix` omitted): emits `unifiedDiff` without modifying disk
      const dryReport = await executeCheckCommand({
        target: './index.html',
        cwd: tempDir,
        only: 'dom',
        viewportsOverride: [{ name: 'desktop', width: 1280, height: 800 }],
        headless: true,
        silentStdout: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      });
      expect(dryReport.exitCode).toBe(1);

      const dryPayload = JSON.parse(
        formatAgenticJsonStream(dryReport, { cwd: tempDir })
      ) as IAgenticJsonStreamPayload;
      expect(dryPayload.violations).toHaveLength(1);
      expect(dryPayload.violations.at(0)?.unifiedDiff).toContain('-    <a id="bad-link" data-source-loc="index.html:4:5" href="javascript:void(0)">Click</a>');
      expect(dryPayload.violations.at(0)?.unifiedDiff).toContain('+    <a id="bad-link" data-source-loc="index.html:4:5" href="#">Click</a>');
      expect(readFileSync(htmlPath, 'utf8')).toContain('javascript:void(0)');

      // 2. Opt-in `--fix`: patches `index.html` on disk and re-verifies `exitCode === 0`
      const fixedReport = await executeCheckCommand({
        target: './index.html',
        cwd: tempDir,
        only: 'dom',
        fix: true,
        viewportsOverride: [{ name: 'desktop', width: 1280, height: 800 }],
        headless: true,
        silentStdout: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      });
      expect(fixedReport.exitCode).toBe(0);
      expect(readFileSync(htmlPath, 'utf8')).toContain('href="#"');
      expect(readFileSync(htmlPath, 'utf8')).not.toContain('javascript:void(0)');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
