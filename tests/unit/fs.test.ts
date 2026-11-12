/**
 * tests/unit/fs.test.ts
 * 1-to-1 unit tests for `src/utils/fs.ts`.
 * Verifies atomic file creation, passing vs. failing GitHub PR comment Markdown generation,
 * Markdown table pipe escaping, and `.uirig/github_pr_comment.md` disk output.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  formatGithubPrCommentMarkdown,
  writeGithubPrCommentReport,
} from '../../src/utils/fs.js';
import type { ICheckExecutionReport } from '../../src/commands/check.js';

function buildSampleReport(passing: boolean): ICheckExecutionReport {
  if (passing) {
    return {
      timestamp: '2026-11-11T22:30:00.000Z',
      configPath: '/workspace/uirig.config.json',
      exitCode: 0,
      summary: {
        totalViewportsAudited: 1,
        totalTokenViolations: 0,
        totalContrastViolations: 0,
        totalStressViolations: 0,
        totalClsViolations: 0,
      },
      results: [
        {
          url: 'http://localhost:3000',
          viewport: { name: 'desktop', width: 1440, height: 900 },
          tokenViolations: [],
          contrastViolations: [],
          stressViolations: [],
          clsEvaluation: { maxSessionCls: 0.01, violation: null },
        },
      ],
    };
  }

  return {
    timestamp: '2026-11-11T22:35:00.000Z',
    configPath: '/workspace/uirig.config.json',
    exitCode: 2,
    summary: {
      totalViewportsAudited: 1,
      totalTokenViolations: 1,
      totalContrastViolations: 1,
      totalStressViolations: 1,
      totalClsViolations: 1,
    },
    results: [
      {
        url: 'http://localhost:3000',
        viewport: { name: 'mobile', width: 375, height: 812 },
        tokenViolations: [
          {
            selector: 'div.hero|banner',
            property: 'color',
            actualValue: 'rgb(12, 34, 56)',
            inShadowDom: true,
          },
        ],
        contrastViolations: [
          {
            selector: 'p.subtitle',
            foregroundRgb: 'rgb(156, 163, 175)',
            backgroundRgb: 'rgb(255, 255, 255)',
            contrastRatio: 2.54,
            inShadowDom: false,
          },
        ],
        stressViolations: [
          {
            violationType: 'container_overflow',
            selector: 'span.cta-label',
            relatedSelector: 'button.primary',
            measuredLeakPixels: 34.5,
            inShadowDom: false,
          },
        ],
        clsEvaluation: {
          maxSessionCls: 0.215,
          violation: {
            measuredClsScore: 0.215,
            clsMaxLimit: 0.1,
            shiftCountInWorstWindow: 2,
            offendingSelectors: ['img.un-sized-hero'],
          },
        },
      },
    ],
  };
}

describe('fs.ts — Markdown PR Comment Reporter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'uirig-fs-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('formats a clean passing Markdown report without violation breakdown tables', () => {
    console.log('[test:fs] Testing passing PR comment Markdown formatting...');
    const md = formatGithubPrCommentMarkdown(buildSampleReport(true));

    expect(md).toContain('✅ **PASSED**');
    expect(md).toContain('| **1. Design Tokens** (`tokens`) | 0 | ✅ Pass |');
    expect(md).toContain('| **4. Layout Shift** (`cls`) | 0 | ✅ Pass |');
    expect(md).not.toContain('### 🔍 Violation Breakdown by Viewport');
  });

  it('formats detailed violation tables across all 4 engines and escapes pipe characters', () => {
    console.log('[test:fs] Testing failing PR comment Markdown formatting and pipe escaping...');
    const md = formatGithubPrCommentMarkdown(buildSampleReport(false));

    expect(md).toContain('❌ **FAILED (POSIX Exit Code 2)**');
    expect(md).toContain('### 🔍 Violation Breakdown by Viewport');
    // Verify pipe character in selector was escaped to prevent Markdown table breakage
    expect(md).toContain('`div.hero\\|banner`');
    expect(md).toContain('**2.54:1** (< 4.5:1)');
    expect(md).toContain('**+34.5px**');
    expect(md).toContain('`img.un-sized-hero`');
  });

  it('atomically creates missing parent directories and writes .uirig/github_pr_comment.md', () => {
    console.log('[test:fs] Testing atomic file write to nested .uirig/github_pr_comment.md...');
    const targetPath = join(tempDir, '.uirig', 'github_pr_comment.md');
    const writtenPath = writeGithubPrCommentReport(buildSampleReport(false), targetPath);

    expect(writtenPath).toBe(targetPath);
    expect(existsSync(targetPath)).toBe(true);

    const diskContent = readFileSync(targetPath, 'utf8');
    expect(diskContent).toContain('## 🛡️ `uirig` UI Verification Gate Report');
    expect(diskContent).toContain('POSIX Exit Code 2');
  });
});
