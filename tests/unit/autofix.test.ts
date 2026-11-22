/**
 * tests/unit/autofix.test.ts
 * Unit specs for Deterministic Auto-Fix Patch Generation (`unifiedDiff`) and
 * Safe Disk Application (`--fix`) (Issue #13 — Chunk 1).
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

describe('::: ISSUE #13 (CHUNK 1): DETERMINISTIC AUTO-FIX UNIFIED DIFF & SAFE APPLIER :::', () => {
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

      // Apply all 3 fixes safely on disk
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

      // 1. Structural/layout violations (`stress`, `cls`) always return null
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

      // 2. Ambiguous line with multiple `#3b82f6` matches returns null
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

      // 3. Path traversal outside `cwd` returns null
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
});
