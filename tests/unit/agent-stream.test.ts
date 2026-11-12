/**
 * tests/unit/agent-stream.test.ts
 * 1-to-1 unit tests for `src/utils/agent-stream.ts`.
 * Verifies:
 * 1. Clean passing reports serialize into valid, ANSI-free agentic JSON with `passed: true`.
 * 2. All engines' defects normalize into uniform `IAgenticViolation` objects with
 *    `hostComponent` attribution, `suggestedToken` hints, and concrete `remediationAdvice`.
 * 3. Repeating pattern violations deduplicate into a single entry with `occurrenceCount`
 *    and `sampleSelectors` to prevent AI context bloat.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeViewportViolations,
  formatAgenticJsonStream,
  type IAgenticJsonStreamPayload,
} from '../../src/utils/agent-stream.js';
import type { ICheckExecutionReport, IViewportAuditReport } from '../../src/commands/check.js';

function createCleanReport(): ICheckExecutionReport {
  return {
    timestamp: '2026-11-12T07:25:00.000Z',
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
        viewport: { name: 'desktop', width: 1280, height: 800 },
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
}

describe('agent-stream.ts — Agentic JSON Tool Stream Generator', () => {
  it('serializes a passing report into valid agentic JSON with passed=true and empty violations', () => {
    console.log('\n--- START TEST: Passing Report Agentic JSON Serialization ---');
    const cleanReport = createCleanReport();
    const jsonOutput = formatAgenticJsonStream(cleanReport);

    // Ensure zero ANSI escape codes leak into stdout JSON stream
    expect(jsonOutput).not.toContain('\x1b[');
    const parsed = JSON.parse(jsonOutput) as IAgenticJsonStreamPayload;

    expect(parsed.tool).toBe('uirig');
    expect(parsed.exitCode).toBe(0);
    expect(parsed.passed).toBe(true);
    expect(parsed.violations).toEqual([]);
    expect(parsed.summary.totalViewportsAudited).toBe(1);
  });
  it('normalizes violations across engines with hostComponent, suggestedToken, and remediationAdvice', () => {
    console.log('\n--- START TEST: Violation Normalization & Remediation Advice ---');
    const failingViewport: IViewportAuditReport = {
      url: 'http://localhost:5173',
      viewport: { name: 'mobile', width: 375, height: 812 },
      tokenViolations: [
        {
          selector: 'ag-button >> shadow-root >> button',
          hostComponent: 'ag-button',
          property: 'backgroundColor',
          actualValue: 'rgb(255, 0, 128)',
          inShadowDom: true,
        },
      ],
      contrastViolations: [
        {
          selector: 'p.muted-caption',
          foregroundRgb: 'rgb(156, 163, 175)',
          backgroundRgb: 'rgb(255, 255, 255)',
          contrastRatio: 2.54,
          suggestedToken: 'rgb(71, 85, 105)',
          inShadowDom: false,
        },
      ],
      stressViolations: [
        {
          violationType: 'container_overflow',
          selector: 'span.card-title',
          relatedSelector: 'div.narrow-card',
          measuredLeakPixels: 28,
          inShadowDom: false,
        },
        {
          violationType: 'horizontal_scrollbar',
          selector: 'document.documentElement',
          measuredLeakPixels: 37,
          inShadowDom: false,
        },
        {
          violationType: 'touch_target_collision',
          selector: 'button#save',
          relatedSelector: 'button#cancel',
          measuredLeakPixels: 14,
          inShadowDom: false,
        },
      ],
      clsEvaluation: {
        maxSessionCls: 0.24,
        violation: {
          measuredClsScore: 0.24,
          clsMaxLimit: 0.1,
          shiftCountInWorstWindow: 2,
          offendingSelectors: ['img.hero-banner'],
        },
      },
    };

    const normalized = normalizeViewportViolations(failingViewport);
    expect(normalized).toHaveLength(6);

    // 1. Token violation check with Shadow host attribution
    expect(normalized.at(0)).toMatchObject({
      engine: 'tokens',
      violationType: 'token_drift',
      hostComponent: 'ag-button',
      viewport: 'mobile (375x812)',
      inShadowDom: true,
      occurrenceCount: 1,
      measuredDelta: 'backgroundColor: rgb(255, 0, 128)',
    });
    expect(normalized.at(0)?.remediationAdvice).toContain('tokensPath');

    // 2. Contrast violation check with nearest passing token suggestion
    expect(normalized.at(1)).toMatchObject({
      engine: 'contrast',
      violationType: 'contrast_drop',
      suggestedToken: 'rgb(71, 85, 105)',
      measuredDelta: 'contrast 2.54:1 (required >= 4.50:1)',
    });
    expect(normalized.at(1)?.remediationAdvice).toContain('rgb(71, 85, 105)');

    // 3. Stress overflow, scrollbar, and touch collision checks
    expect(normalized.at(2)?.violationType).toBe('container_overflow');
    expect(normalized.at(2)?.remediationAdvice).toContain('div.narrow-card');
    expect(normalized.at(3)?.violationType).toBe('horizontal_scrollbar');
    expect(normalized.at(3)?.remediationAdvice).toContain('max-width: 100%');
    expect(normalized.at(4)?.violationType).toBe('touch_target_collision');
    expect(normalized.at(4)?.remediationAdvice).toContain('button#cancel');

    // 4. CLS breach check
    expect(normalized.at(5)).toMatchObject({
      engine: 'cls',
      violationType: 'cls_breach',
      selector: 'img.hero-banner',
      measuredDelta: 'CLS 0.240 (max 0.100)',
    });
    expect(normalized.at(5)?.remediationAdvice).toContain('img.hero-banner');
  });

  it('deduplicates repeating pattern violations with occurrenceCount and sampleSelectors', () => {
    console.log('\n--- START TEST: Repeating Violation Pattern Deduplication ---');
    const report = createCleanReport();
    report.exitCode = 1;
    const firstResult = report.results.at(0);
    if (firstResult) {
      firstResult.contrastViolations = [
        {
          selector: 'li#card-1 > span.muted',
          foregroundRgb: 'rgb(156, 163, 175)',
          backgroundRgb: 'rgb(255, 255, 255)',
          contrastRatio: 2.54,
          inShadowDom: false,
        },
        {
          selector: 'li#card-2 > span.muted',
          foregroundRgb: 'rgb(156, 163, 175)',
          backgroundRgb: 'rgb(255, 255, 255)',
          contrastRatio: 2.54,
          inShadowDom: false,
        },
        {
          selector: 'li#card-3 > span.muted',
          foregroundRgb: 'rgb(156, 163, 175)',
          backgroundRgb: 'rgb(255, 255, 255)',
          contrastRatio: 2.54,
          inShadowDom: false,
        },
      ];
    }

    const parsed = JSON.parse(formatAgenticJsonStream(report)) as IAgenticJsonStreamPayload;
    expect(parsed.violations).toHaveLength(1);
    expect(parsed.violations.at(0)?.occurrenceCount).toBe(3);
    expect(parsed.violations.at(0)?.sampleSelectors).toEqual([
      'li#card-1 > span.muted',
      'li#card-2 > span.muted',
      'li#card-3 > span.muted',
    ]);
  });
});
