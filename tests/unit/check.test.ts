/**
 * tests/unit/check.test.ts
 * 1-to-1 unit tests for `src/commands/check.ts`.
 * Covers configuration loading, token scale validation, and POSIX exit code resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadUirigConfig,
  loadTokenScale,
  evaluatePosixExitCode,
  type IViewportAuditReport,
} from '../../src/commands/check.js';

function createCleanViewportReport(): IViewportAuditReport {
  return {
    url: 'http://localhost:3000',
    viewport: { name: 'desktop', width: 1440, height: 900 },
    tokenViolations: [],
    contrastViolations: [],
    stressViolations: [],
    clsEvaluation: {
      maxSessionCls: 0.02,
      violation: null,
    },
  };
}

describe('check.ts (Micro-Chunk 1) — Config Loader & POSIX Exit Code Evaluator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'uirig-check-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads and validates a well-formed uirig.config.json and linked token scale', () => {
    console.log('[test:check] Testing valid uirig.config.json and token scale loading...');
    const tokensFile = join(tempDir, 'tokens.json');
    const configFile = join(tempDir, 'uirig.config.json');

    writeFileSync(
      tokensFile,
      JSON.stringify({
        colors: ['rgb(255, 255, 255)', 'rgb(0, 0, 0)'],
        spacing: ['0px', '8px', '16px'],
        fontSizes: ['14px', '16px'],
        radii: ['0px', '4px'],
      }),
      'utf8'
    );

    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: ['http://localhost:3000'],
        tokensPath: './tokens.json',
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'mobile', width: 375, height: 812 }],
      }),
      'utf8'
    );

    const config = loadUirigConfig(configFile);
    expect(config.targetUrls).toEqual(['http://localhost:3000']);
    expect(config.thresholdBudgets.clsMaxLimit).toBe(0.1);

    const scale = loadTokenScale(config.tokensPath, configFile);
    expect(scale.colors).toContain('rgb(255, 255, 255)');
    expect(scale.spacing).toEqual(['0px', '8px', '16px']);
  });

  it('throws descriptive ERR_CONFIG_MISSING and ERR_CONFIG_SCHEMA errors on invalid configs', () => {
    console.log('[test:check] Testing error handling for missing and malformed configs...');
    const missingFile = join(tempDir, 'nonexistent.json');
    expect(() => loadUirigConfig(missingFile)).toThrow(/ERR_CONFIG_MISSING/);

    const badSchemaFile = join(tempDir, 'bad.config.json');
    writeFileSync(badSchemaFile, JSON.stringify({ targetUrls: [] }), 'utf8');
    expect(() => loadUirigConfig(badSchemaFile)).toThrow(/ERR_CONFIG_SCHEMA/);
  });

  it('throws ERR_TOKENS_MISSING or ERR_TOKENS_SCHEMA when token file is missing or incomplete', () => {
    console.log('[test:check] Testing error handling for missing or invalid token scale files...');
    const configFile = join(tempDir, 'uirig.config.json');
    expect(() => loadTokenScale('./missing-tokens.json', configFile)).toThrow(/ERR_TOKENS_MISSING/);

    const badTokensFile = join(tempDir, 'bad-tokens.json');
    writeFileSync(badTokensFile, JSON.stringify({ colors: ['rgb(0, 0, 0)'] }), 'utf8');
    expect(() => loadTokenScale('./bad-tokens.json', configFile)).toThrow(/ERR_TOKENS_SCHEMA/);
  });

  it('returns POSIX exit code 0 when all 4 audits pass across viewports', () => {
    console.log('[test:check] Verifying POSIX exit code 0 on clean audit results...');
    const exitCode = evaluatePosixExitCode([createCleanViewportReport()]);
    expect(exitCode).toBe(0);
  });

  it('returns POSIX exit code 1 on WCAG contrast or design token violations', () => {
    console.log('[test:check] Verifying POSIX exit code 1 on contrast/token failures...');
    const contrastFail = createCleanViewportReport();
    contrastFail.contrastViolations.push({
      selector: 'p.muted',
      foregroundRgb: 'rgb(156, 163, 175)',
      backgroundRgb: 'rgb(255, 255, 255)',
      contrastRatio: 2.54,
      inShadowDom: false,
    });
    expect(evaluatePosixExitCode([contrastFail])).toBe(1);

    const tokenFail = createCleanViewportReport();
    tokenFail.tokenViolations.push({
      selector: 'div.box',
      property: 'paddingTop',
      actualValue: '13px',
      inShadowDom: false,
    });
    expect(evaluatePosixExitCode([tokenFail])).toBe(1);
  });

  it('returns POSIX exit code 2 on geometric stress overflow or CLS budget breaches', () => {
    console.log('[test:check] Verifying POSIX exit code 2 on geometric stress & CLS breaches...');
    const stressFail = createCleanViewportReport();
    stressFail.stressViolations.push({
      violationType: 'container_overflow',
      selector: 'span.label',
      relatedSelector: 'div.card',
      measuredLeakPixels: 42,
      inShadowDom: false,
    });
    expect(evaluatePosixExitCode([stressFail])).toBe(2);

    const clsFail = createCleanViewportReport();
    clsFail.clsEvaluation = {
      maxSessionCls: 0.25,
      violation: {
        measuredClsScore: 0.25,
        clsMaxLimit: 0.1,
        shiftCountInWorstWindow: 2,
        offendingSelectors: ['img.banner'],
      },
    };
    expect(evaluatePosixExitCode([clsFail])).toBe(2);
  });
});
