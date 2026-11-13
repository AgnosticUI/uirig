/**
 * tests/unit/console-report.test.ts
 * 1-to-1 unit tests for `src/utils/console-report.ts`.
 * Verifies:
 * 1. Compact summary rendering (`verbose: false`) shows per-engine pass/fail counts
 *    and the `--verbose` hint without flooding the terminal with individual selectors.
 * 2. Verbose rendering (`verbose: true`) prints every failing selector, ShadowDOM tag,
 *    contrast ratio, suggested token, stress leak, CLS element, DOM rule, and runtime error.
 * 3. Clean passing reports (`exitCode: 0`) omit the `--verbose` tip.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { formatConsoleAuditReport } from '../../src/utils/console-report.js';
import type { ICheckExecutionReport } from '../../src/commands/check.js';

function createSampleFailingReport(): ICheckExecutionReport {
  return {
    timestamp: '2026-11-13T06:50:00.000Z',
    configPath: '/workspace/uirig.config.json',
    reportPath: '/workspace/.uirig/github_pr_comment.md',
    exitCode: 2,
    summary: {
      totalViewportsAudited: 1,
      totalTokenViolations: 1,
      totalContrastViolations: 1,
      totalDarkModeViolations: 1,
      totalStressViolations: 1,
      totalClsViolations: 1,
      totalDomViolations: 1,
      totalRuntimeErrors: 1,
    },
    results: [
      {
        url: 'http://localhost:5173',
        viewport: { name: 'desktop', width: 1440, height: 900 },
        tokenViolations: [
          {
            selector: 'ag-button#cta >> shadow-root >> button',
            hostComponent: 'ag-button',
            property: 'backgroundColor',
            actualValue: 'rgb(255, 0, 128)',
            inShadowDom: true,
          },
        ],
        contrastViolations: [
          {
            selector: 'p.muted-note',
            hostComponent: null,
            foregroundRgb: 'rgb(156, 163, 175)',
            backgroundRgb: 'rgb(255, 255, 255)',
            contrastRatio: 2.54,
            suggestedToken: 'rgb(17, 24, 39)',
            inShadowDom: false,
          },
        ],
        darkModeViolations: [
          {
            violationType: 'stranded_light_surface',
            selector: 'div.white-card',
            hostComponent: null,
            backgroundRgb: 'rgb(255, 255, 255)',
            relativeLuminance: 1.0,
            inShadowDom: false,
          },
        ],
        stressViolations: [
          {
            violationType: 'container_overflow',
            selector: 'span#overflow-label',
            relatedSelector: 'div#overflow-box',
            hostComponent: null,
            measuredLeakPixels: 42,
            inShadowDom: false,
          },
        ],
        clsEvaluation: {
          maxSessionCls: 0.18,
          violation: {
            measuredClsScore: 0.18,
            clsMaxLimit: 0.1,
            shiftCountInWorstWindow: 1,
            offendingSelectors: ['img.hero-banner'],
          },
        },
        domViolations: [
          {
            rule: 'unlabeled_control',
            selector: 'input#email-field',
            hostComponent: null,
            detail: 'Input uses placeholder without an accessible label',
            inShadowDom: false,
          },
        ],
        runtimeErrors: [
          {
            source: 'pageerror',
            message: 'ReferenceError: missingFn is not defined',
            location: 'http://localhost:5173',
          },
        ],
      },
    ],
  };
}

describe('console-report.ts — Structured Multi-Engine Console Report Formatter', () => {
  const originalNoColor = process.env.NO_COLOR;

  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalNoColor;
    }
  });

  it('renders compact per-engine failure counts and --verbose tip when verbose is false', () => {
    process.env.NO_COLOR = '1';
    console.log('\n--- START TEST: Compact Console Report Rendering (verbose=false) ---');

    const output = formatConsoleAuditReport(createSampleFailingReport(), { verbose: false });

    expect(output).toContain('uirig Live Multi-Engine Check Report');
    expect(output).toContain('1. [tokens]    Design Token Violations : 1 FAIL');
    expect(output).toContain('2. [contrast]  Contrast Violations     : 1 FAIL');
    expect(output).toContain('3. [dark-mode] Dark-Mode Violations    : 1 FAIL');
    expect(output).toContain('4. [stress]    Geometric Stress Hits   : 1 FAIL');
    expect(output).toContain('5. [cls]       Max Session CLS Score   : 0.18 -> FAIL (Shift Detected)');
    expect(output).toContain('6. [dom]       DOM & A11y Violations   : 1 FAIL');
    expect(output).toContain('7. [runtime]   Runtime JS Errors       : 1 FAIL');
    expect(output).toContain('Tip: 7 violation(s) detected. Re-run with --verbose');

    // Individual selector lines should stay hidden in compact mode
    expect(output).not.toContain('p.muted-note');
    expect(output).not.toContain('span#overflow-label');
  });

  it('renders full selector paths, ShadowDOM tags, and token hints when verbose is true', () => {
    process.env.NO_COLOR = '1';
    console.log('\n--- START TEST: Verbose Console Report Rendering (verbose=true) ---');

    const output = formatConsoleAuditReport(createSampleFailingReport(), { verbose: true });

    expect(output).toContain('ag-button#cta >> shadow-root >> button');
    expect(output).toContain('[ShadowDOM]');
    expect(output).toContain('p.muted-note (2.54:1 < 4.5:1');
    expect(output).toContain('-> try rgb(17, 24, 39)');
    expect(output).toContain('[stranded_light_surface] div.white-card');
    expect(output).toContain('[container_overflow] span#overflow-label -> div#overflow-box (+42)');
    expect(output).toContain('Shifting elements: img.hero-banner');
    expect(output).toContain('[pageerror] ReferenceError: missingFn is not defined');
    expect(output).toContain('[unlabeled_control] input#email-field');
    expect(output).not.toContain('Re-run with --verbose');
  });

  it('renders clean PASS badges without --verbose tip when zero violations exist', () => {
    process.env.NO_COLOR = '1';
    console.log('\n--- START TEST: Clean Passing Console Report Rendering ---');

    const passingReport: ICheckExecutionReport = {
      timestamp: '2026-11-13T06:50:00.000Z',
      configPath: '/workspace/uirig.config.json',
      reportPath: '/workspace/.uirig/github_pr_comment.md',
      exitCode: 0,
      summary: {
        totalViewportsAudited: 1,
        totalTokenViolations: 0,
        totalContrastViolations: 0,
        totalDarkModeViolations: 0,
        totalStressViolations: 0,
        totalClsViolations: 0,
        totalDomViolations: 0,
        totalRuntimeErrors: 0,
      },
      results: [
        {
          url: 'http://localhost:5173',
          viewport: { name: 'desktop', width: 1440, height: 900 },
          tokenViolations: [],
          contrastViolations: [],
          darkModeViolations: [],
          stressViolations: [],
          clsEvaluation: { maxSessionCls: 0.01, violation: null },
          domViolations: [],
          runtimeErrors: [],
        },
      ],
    };

    const output = formatConsoleAuditReport(passingReport, { verbose: false });

    expect(output).toContain('1. [tokens]    Design Token Violations : 0 PASS');
    expect(output).toContain('5. [cls]       Max Session CLS Score   : 0.01 -> PASS');
    expect(output).not.toContain('Re-run with --verbose');
  });
});
