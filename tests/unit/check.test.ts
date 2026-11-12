/**
 * tests/unit/check.test.ts
 * 1-to-1 unit & integration tests for `src/commands/check.ts`.
 * Covers configuration loading, token scale validation, POSIX exit code resolution,
 * and concurrent 3-context Playwright execution against local HTTP fixtures.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createServer, type Server } from 'http';
import {
  loadUirigConfig,
  loadTokenScale,
  evaluatePosixExitCode,
  executeCheckCommand,
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

function startFixtureServer(html: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolveServer) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolveServer({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('check.ts — Isolated Parallel Context Dispatcher', () => {
  let tempDir: string;
  let activeServer: Server | null = null;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'uirig-check-test-'));
  });

  afterEach(async () => {
    if (activeServer) {
      await new Promise<void>((resolveClose) => {
        activeServer?.close(() => resolveClose());
      });
      activeServer = null;
    }
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

    it('executes 3 isolated Playwright contexts concurrently and returns exitCode 0 for a compliant page', async () => {
    console.log('[test:check] Running live 3-context parallel check on a compliant HTML fixture...');
    const compliantHtml = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background-color: rgb(255, 255, 255); color: rgb(17, 24, 39); font-size: 16px; }
            main { padding: 16px; background-color: rgb(243, 244, 246); border-radius: 8px; }
            h1 { margin: 0 0 16px 0; font-size: 24px; color: rgb(17, 24, 39); }
            p { margin: 0; font-size: 16px; color: rgb(17, 24, 39); }
          </style>
        </head>
        <body>
          <main>
            <h1>Compliant Header</h1>
            <p>All tokens, contrast ratios, layout bounds, and CLS budgets pass cleanly.</p>
          </main>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(compliantHtml);
    activeServer = server;

    const tokensFile = join(tempDir, 'tokens.json');
    const configFile = join(tempDir, 'uirig.config.json');

    writeFileSync(
      tokensFile,
      JSON.stringify({
        colors: ['rgb(255, 255, 255)', 'rgb(17, 24, 39)', 'rgb(243, 244, 246)'],
        spacing: ['0px', '16px'],
        fontSizes: ['16px', '24px'],
        radii: ['0px', '8px'],
      }),
      'utf8'
    );

    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: [url],
        tokensPath: './tokens.json',
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1024, height: 768 }],
      }),
      'utf8'
    );

    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
    const report = await executeCheckCommand({
      configPath: configFile,
      headless: true,
      reportOutputPath: reportOutput,
    });


    expect(report.exitCode).toBe(0);
    expect(report.summary.totalViewportsAudited).toBe(1);
    expect(report.summary.totalTokenViolations).toBe(0);
    expect(report.summary.totalContrastViolations).toBe(0);
    expect(report.summary.totalStressViolations).toBe(0);
    expect(report.summary.totalClsViolations).toBe(0);
  });

  it('detects structural overflow in Context 2 without polluting Context 1 read-only audits and returns exitCode 2', async () => {
    console.log('[test:check] Running live 3-context parallel check on a stress-overflow fixture...');
    const overflowHtml = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background-color: rgb(255, 255, 255); color: rgb(17, 24, 39); font-size: 16px; }
            .cramped-box { width: 120px; padding: 8px; background-color: rgb(243, 244, 246); border-radius: 4px; }
            .nowrap-label { display: inline-block; white-space: nowrap; font-size: 16px; color: rgb(17, 24, 39); }
          </style>
        </head>
        <body>
          <div class="cramped-box">
            <span class="nowrap-label">Expanding Text Label</span>
          </div>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(overflowHtml);
    activeServer = server;

    const tokensFile = join(tempDir, 'tokens.json');
    const configFile = join(tempDir, 'uirig.config.json');

    writeFileSync(
      tokensFile,
      JSON.stringify({
        colors: ['rgb(255, 255, 255)', 'rgb(17, 24, 39)', 'rgb(243, 244, 246)'],
        spacing: ['0px', '8px', '16px'],
        fontSizes: ['16px'],
        radii: ['0px', '4px'],
      }),
      'utf8'
    );

    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: [url],
        tokensPath: './tokens.json',
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1024, height: 768 }],
      }),
      'utf8'
    );

    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
    const report = await executeCheckCommand({
      configPath: configFile,
      headless: true,
      json: true,
      reportOutputPath: reportOutput,
    });

    expect(report.exitCode).toBe(2);
    expect(report.summary.totalTokenViolations).toBe(0);
    expect(report.summary.totalContrastViolations).toBe(0);
    expect(report.summary.totalStressViolations).toBeGreaterThan(0);
  });

  it('suppresses console chatter and writes pure agentic JSON to stdout when options.json is true', async () => {
    console.log('\n--- START TEST: Pure stdout JSON Stream Mode (--json) ---');
    const contrastFailHtml = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background-color: rgb(255, 255, 255); color: rgb(17, 24, 39); font-size: 16px; }
            p.low-contrast { margin: 0; font-size: 16px; color: rgb(156, 163, 175); }
          </style>
        </head>
        <body>
          <p class="low-contrast">Hard to read muted text</p>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(contrastFailHtml);
    activeServer = server;

    const tokensFile = join(tempDir, 'tokens.json');
    const configFile = join(tempDir, 'uirig.config.json');

    writeFileSync(
      tokensFile,
      JSON.stringify({
        colors: ['rgb(255, 255, 255)', 'rgb(17, 24, 39)', 'rgb(156, 163, 175)'],
        spacing: ['0px', '16px'],
        fontSizes: ['16px'],
        radii: ['0px'],
      }),
      'utf8'
    );

    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: [url],
        tokensPath: './tokens.json',
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1024, height: 768 }],
      }),
      'utf8'
    );

    const capturedChunks: string[] = [];
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        capturedChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
        return true;
      });

    try {
      const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
      const report = await executeCheckCommand({
        configPath: configFile,
        headless: true,
        json: true,
        reportOutputPath: reportOutput,
      });

      expect(report.exitCode).toBe(1);
      const rawStdout = capturedChunks.join('');
      const parsed = JSON.parse(rawStdout) as {
        tool: string;
        exitCode: number;
        passed: boolean;
        violations: Array<{ engine: string; remediationAdvice: string }>;
      };

      expect(parsed.tool).toBe('uirig');
      expect(parsed.exitCode).toBe(1);
      expect(parsed.passed).toBe(false);
      expect(parsed.violations.length).toBeGreaterThan(0);
      expect(parsed.violations.at(0)?.engine).toBe('contrast');
      expect(parsed.violations.at(0)?.remediationAdvice).toContain('4.50:1');
    } finally {
      stdoutSpy.mockRestore();
    }
  });

});

