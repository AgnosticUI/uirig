/**
 * tests/unit/check.test.ts
 * 1-to-1 unit & integration tests for `src/commands/check.ts`.
 * Covers configuration loading, token scale validation, POSIX exit code resolution,
 * zero-config local `.html` file execution, `--selectors` component scoping & matched
 * element counts, multi-theme labels, and concurrent Playwright runs.
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
  auditViewportInParallel,
  executeCheckCommand,
  ZERO_CONFIG_DEFAULTS,
  FALLBACK_TOKEN_SCALE,
  type IViewportAuditReport,
} from '../../src/commands/check.js';

import { WarmBrowserPool } from '../../src/core/browser-pool.js';

function createCleanViewportReport(): IViewportAuditReport {
  return {
    url: 'http://localhost:3000',
    viewport: { name: 'desktop', width: 1440, height: 900 },
    tokenViolations: [],
    contrastViolations: [],
    darkModeViolations: [],
    stressViolations: [],
    clsEvaluation: {
      maxSessionCls: 0.02,
      violation: null,
    },
    domViolations: [],
    runtimeErrors: [],
  };
}

function startFixtureServer(html: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolveServer) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'DENY',
      });
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

    const scale = loadTokenScale(config.tokensPath as string, configFile);
    expect(scale.colors).toContain('rgb(255, 255, 255)');
    expect(scale.spacing).toEqual(['0px', '8px', '16px']);
  });
  it('throws descriptive ERR_CONFIG_MISSING and ERR_CONFIG_SCHEMA errors on invalid configs', () => {
    const missingFile = join(tempDir, 'nonexistent.json');
    expect(() => loadUirigConfig(missingFile)).toThrow(/ERR_CONFIG_MISSING/);

    const badSchemaFile = join(tempDir, 'bad.config.json');
    writeFileSync(badSchemaFile, JSON.stringify({ targetUrls: [] }), 'utf8');
    expect(() => loadUirigConfig(badSchemaFile)).toThrow(/ERR_CONFIG_SCHEMA/);
  });

  it('throws ERR_TOKENS_MISSING or ERR_TOKENS_SCHEMA when token file is missing or incomplete', () => {
    const configFile = join(tempDir, 'uirig.config.json');
    expect(() => loadTokenScale('./missing-tokens.json', configFile)).toThrow(/ERR_TOKENS_MISSING/);

    const badTokensFile = join(tempDir, 'bad-tokens.json');
    writeFileSync(badTokensFile, JSON.stringify({ colors: ['rgb(0, 0, 0)'] }), 'utf8');
    expect(() => loadTokenScale('./bad-tokens.json', configFile)).toThrow(/ERR_TOKENS_SCHEMA/);
  });

  it('returns POSIX exit code 0 when all audits pass across viewports', () => {
    const exitCode = evaluatePosixExitCode([createCleanViewportReport()]);
    expect(exitCode).toBe(0);
  });

  it('returns POSIX exit code 1 on WCAG contrast or design token violations', () => {
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

  it('runs zero-config mode against a standalone local .html file with no uirig.config.json', async () => {
    const htmlPath = join(tempDir, 'standalone.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --bg: #ffffff; --fg: #111827; }
            :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
            body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font-family: sans-serif; }
            h1 { margin: 0 0 12px 0; font-size: 22px; }
            p { margin: 0; font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>Zero-Config Standalone Preview</h1>
          <p>Runs contrast, dark-mode, stress, and CLS checks automatically with no config file.</p>
        </body>
      </html>`,
      'utf8'
    );

    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
    const report = await executeCheckCommand({
      target: './standalone.html',
      cwd: tempDir,
      headless: true,
      reportOutputPath: reportOutput,
    });

    expect(report.exitCode).toBe(0);
    expect(report.configPath).toBe('zero-config (built-in defaults)');
    expect(report.summary.totalViewportsAudited).toBe(2);
    expect(report.results.at(0)?.url).toBe('./standalone.html');
  });

    it('executes isolated Playwright contexts concurrently and returns exitCode 0 for a compliant page', async () => {
    const compliantHtml = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background-color: rgb(255, 255, 255); color: rgb(17, 24, 39); font-size: 16px; }
            main { padding: 16px; background-color: rgb(243, 244, 246); border-radius: 8px; }
            h1 { margin: 0 0 16px 0; font-size: 24px; color: rgb(17, 24, 39); }
            p { margin: 0; font-size: 16px; color: rgb(17, 24, 39); }
            :root[data-theme="dark"] body { background-color: rgb(17, 24, 39); color: rgb(255, 255, 255); }
            :root[data-theme="dark"] main { background-color: rgb(17, 24, 39); }
            :root[data-theme="dark"] h1, :root[data-theme="dark"] p { color: rgb(255, 255, 255); }
          </style>
        </head>
        <body>
          <main>
            <h1>Compliant Header</h1>
            <p>All tokens, contrast ratios, dark-mode parity, layout bounds, and CLS budgets pass cleanly.</p>
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
  });

  it('catches dark-mode stranded light surfaces in Track 2 without polluting light-mode audits and returns exitCode 1', async () => {
    const lightOnlyCardHtml = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background-color: rgb(15, 23, 42); color: rgb(248, 250, 252); }
            .stranded-card { width: 320px; height: 140px; padding: 16px; background-color: rgb(255, 255, 255); color: rgb(17, 24, 39); }
          </style>
        </head>
        <body>
          <div class="stranded-card">Stranded light card in dark mode</div>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(lightOnlyCardHtml);
    activeServer = server;

    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
    const report = await executeCheckCommand({
      target: url,
      cwd: tempDir,
      headless: true,
      only: 'dark-mode',
      reportOutputPath: reportOutput,
    });

    expect(report.exitCode).toBe(1);
    expect(report.summary.totalDarkModeViolations).toBeGreaterThan(0);
    expect(report.summary.totalContrastViolations).toBe(0);
  });
  it('detects structural overflow in stress track without polluting read-only audits and returns exitCode 2', async () => {
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
    expect(report.summary.totalStressViolations).toBeGreaterThan(0);
  });

  it('suppresses console chatter and writes pure agentic JSON to stdout when options.json is true', async () => {
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
      const parsed = JSON.parse(capturedChunks.join('')) as {
        tool: string;
        exitCode: number;
        passed: boolean;
        violations: Array<{ engine: string; remediationAdvice: string }>;
      };

      expect(parsed.tool).toBe('uirig');
      expect(parsed.exitCode).toBe(1);
      expect(parsed.passed).toBe(false);
      expect(parsed.violations.at(0)?.engine).toBe('contrast');
    } finally {
      stdoutSpy.mockRestore();
    }
  });

    it('filters execution to a single engine when options.only is specified', async () => {
    const mixedHtml = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background-color: rgb(255, 255, 255); color: rgb(17, 24, 39); font-size: 16px; }
            p.low-contrast { margin: 0; font-size: 16px; color: rgb(156, 163, 175); }
            .cramped { width: 80px; }
            .nowrap { display: inline-block; white-space: nowrap; }
          </style>
        </head>
        <body>
          <p class="low-contrast">Muted text</p>
          <div class="cramped"><span class="nowrap">Long text that would fail stress</span></div>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(mixedHtml);
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

    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
    const report = await executeCheckCommand({
      configPath: configFile,
      headless: true,
      only: 'contrast',
      reportOutputPath: reportOutput,
    });

    expect(report.exitCode).toBe(1);
    expect(report.summary.totalContrastViolations).toBeGreaterThan(0);
    expect(report.summary.totalStressViolations).toBe(0);
    expect(report.summary.totalTokenViolations).toBe(0);
  });

  it('catches structural DOM hallucinations via --only=dom and returns exitCode 1', async () => {
    const brokenDomHtml = `<!DOCTYPE html>
      <html>
        <body>
          <input placeholder="Unlabeled input" />
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(brokenDomHtml);
    activeServer = server;

    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
    const report = await executeCheckCommand({
      target: url,
      cwd: tempDir,
      headless: true,
      only: 'dom',
      reportOutputPath: reportOutput,
    });

    expect(report.exitCode).toBe(1);
    expect(report.summary.totalDomViolations).toBeGreaterThan(0);
  });

  it('captures uncaught runtime JS pageerror exceptions during navigation and returns exitCode 1', async () => {
    const runtimeCrashHtml = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --bg: #ffffff; --fg: #111827; }
            :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
            body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); }
          </style>
        </head>
        <body>
          <h1>Hydration Crash Fixture</h1>
          <script>
            throw new TypeError('Cannot read properties of undefined (reading "mount")');
          </script>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(runtimeCrashHtml);
    activeServer = server;

    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
    const report = await executeCheckCommand({
      target: url,
      cwd: tempDir,
      headless: true,
      reportOutputPath: reportOutput,
    });

    expect(report.exitCode).toBe(1);
    expect(report.summary.totalRuntimeErrors).toBeGreaterThan(0);
    expect(report.results.at(0)?.runtimeErrors?.at(0)?.message).toContain(
      'Cannot read properties of undefined'
    );
  });
  it('scopes element-level audits to options.selectors, reports matchedSelectorCount, and rejects malformed selectors', async () => {
    const mixedPageHtml = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --bg: #ffffff; --fg: #111827; }
            :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
            body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); }
            #noisy-header .bad-contrast { color: rgb(210, 210, 210); }
            #clean-widget p { margin: 0; font-size: 16px; }
          </style>
        </head>
        <body>
          <header id="noisy-header">
            <span class="bad-contrast">Off-scope low contrast</span>
            <input placeholder="Off-scope unlabeled input" />
          </header>
          <section id="clean-widget">
            <p>Clean scoped component</p>
          </section>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(mixedPageHtml);
    activeServer = server;

    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
    const scopedReport = await executeCheckCommand({
      target: url,
      cwd: tempDir,
      headless: true,
      selectors: ['#clean-widget'],
      reportOutputPath: reportOutput,
    });

    expect(scopedReport.exitCode).toBe(0);
    expect(scopedReport.summary.totalContrastViolations).toBe(0);
    expect(scopedReport.summary.totalDomViolations).toBe(0);
    expect(scopedReport.results.at(0)?.matchedSelectorCount).toBe(1);

    const zeroMatchReport = await executeCheckCommand({
      target: url,
      cwd: tempDir,
      headless: true,
      selectors: ['.does-not-exist-anywhere'],
      reportOutputPath: reportOutput,
    });
    expect(zeroMatchReport.exitCode).toBe(0);
    expect(zeroMatchReport.results.at(0)?.matchedSelectorCount).toBe(0);

    await expect(
      executeCheckCommand({
        target: url,
        cwd: tempDir,
        headless: true,
        selectors: ['div > > .malformed'],
        reportOutputPath: reportOutput,
      })
    ).rejects.toThrow(/ERR_INVALID_SELECTOR/);
  });

  it('reuses an injected WarmBrowserPool across runs without closing the shared browser and honors silentStdout', async () => {
    const htmlPath = join(tempDir, 'warm-check.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --bg: #ffffff; --fg: #111827; }
            :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
            body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); }
          </style>
        </head>
        <body><h1>Warm MCP Pool Reuse</h1></body>
      </html>`,
      'utf8'
    );

    const pool = new WarmBrowserPool({ headless: true, idleTimeoutMs: 60_000 });
    const acquireSpy = vi.spyOn(pool, 'acquire');
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');

      const first = await executeCheckCommand({
        target: './warm-check.html',
        cwd: tempDir,
        only: 'contrast',
        browserPool: pool,
        silentStdout: true,
        reportOutputPath: reportOutput,
      });

      expect(first.exitCode).toBe(0);
      expect(acquireSpy).toHaveBeenCalledTimes(1);
      expect(pool.isHealthy()).toBe(true);
      expect(stdoutSpy).not.toHaveBeenCalled();

      const second = await executeCheckCommand({
        target: './warm-check.html',
        cwd: tempDir,
        only: 'dom',
        browserPool: pool,
        silentStdout: true,
        reportOutputPath: reportOutput,
      });

      expect(second.exitCode).toBe(0);
      expect(acquireSpy).toHaveBeenCalledTimes(2);
      expect(pool.isHealthy()).toBe(true);
      expect(stdoutSpy).not.toHaveBeenCalled();
    } finally {
      stdoutSpy.mockRestore();
      await pool.dispose();
    }
  });
  it('skips loading tokensPath when only is stress, cls, or dom', async () => {
    const htmlPath = join(tempDir, 'page.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html><html><body><h1>Clean DOM</h1></body></html>`,
      'utf8'
    );

    const configFile = join(tempDir, 'uirig.config.json');
    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: ['./page.html'],
        tokensPath: './missing-tokens.json',
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );

    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');
    for (const engine of ['stress', 'cls', 'dom'] as const) {
      const report = await executeCheckCommand({
        cwd: tempDir,
        only: engine,
        headless: true,
        reportOutputPath: reportOutput,
      });
      expect(report.exitCode).toBe(0);
    }
  });

  it('warns to stderr and falls back to null when tokensPath is missing for contrast or dark-mode with explicit target', async () => {
    const htmlPath = join(tempDir, 'card.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background: #0f172a; color: #f8fafc; font-family: sans-serif; }
          </style>
        </head>
        <body><h1>Accessible Dark Card</h1></body>
      </html>`,
      'utf8'
    );

    const configFile = join(tempDir, 'uirig.config.json');
    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: ['http://localhost:3000'],
        tokensPath: './missing-tokens.json',
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );

    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reportOutput = join(tempDir, '.uirig', 'github_pr_comment.md');

    try {
      for (const engine of ['contrast', 'dark-mode'] as const) {
        stderrSpy.mockClear();
        const report = await executeCheckCommand({
          cwd: tempDir,
          target: './card.html',
          only: engine,
          headless: true,
          reportOutputPath: reportOutput,
        });
        expect(report.exitCode).toBe(0);
        expect(stderrSpy).toHaveBeenCalled();
        expect(stderrSpy.mock.calls.flat().join(' ')).toMatch(/ERR_TOKENS_MISSING|tokensPath/i);
      }
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it.each([
    { label: 'only is tokens with explicit target', options: { only: 'tokens' as const, target: 'http://localhost:3000' } },
    { label: 'full check (only is undefined)', options: { only: undefined, target: 'http://localhost:3000' } },
    { label: 'only is contrast without explicit target', options: { only: 'contrast' as const, target: undefined } },
    { label: 'only is dark-mode without explicit target', options: { only: 'dark-mode' as const, target: undefined } },
  ])('rejects with ERR_TOKENS_MISSING when tokensPath is missing and $label', async ({ options }) => {
    const configFile = join(tempDir, 'uirig.config.json');
    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: ['http://localhost:3000'],
        tokensPath: './missing-tokens.json',
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );

    await expect(
      executeCheckCommand({
        cwd: tempDir,
        headless: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
        ...options,
      })
    ).rejects.toThrow(/ERR_TOKENS_MISSING/);
  });
  it('populates suggestedToken from live :root CSS variables when autoTokens is enabled with zero config files', async () => {
    const htmlPath = join(tempDir, 'auto-tokens-hero.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root {
              --color-surface: #ffffff;
              --color-ink-strong: #0f172a;
              --color-muted: #9ca3af;
            }
            body { margin: 0; padding: 16px; background: var(--color-surface); color: var(--color-ink-strong); }
            p.low-contrast { margin: 0; font-size: 16px; color: var(--color-muted); }
          </style>
        </head>
        <body>
          <p class="low-contrast">Low contrast text with auto-discovered tokens</p>
        </body>
      </html>`,
      'utf8'
    );

    const report = await executeCheckCommand({
      target: './auto-tokens-hero.html',
      cwd: tempDir,
      only: 'contrast',
      autoTokens: true,
      headless: true,
      reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
    });

    expect(report.exitCode).toBe(1);
    const violation = report.results.at(0)?.contrastViolations.at(0);
    expect(violation).toBeDefined();
    expect(violation?.suggestedToken).toBe('rgb(15, 23, 42)');
  });

  it('gives explicit tokensPath precedence over autoTokens when both are configured', async () => {
    const htmlPath = join(tempDir, 'precedence.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --color-auto-only: #2563eb; }
            body { margin: 0; padding: 16px; background: #ffffff; color: #2563eb; font-size: 16px; }
          </style>
        </head>
        <body><p>Styled with auto-only token</p></body>
      </html>`,
      'utf8'
    );

    const explicitTokensFile = join(tempDir, 'explicit-tokens.json');
    writeFileSync(
      explicitTokensFile,
      JSON.stringify({
        colors: ['rgb(255, 255, 255)', 'rgb(0, 0, 0)'],
        spacing: ['0px', '16px'],
        fontSizes: ['16px'],
        radii: ['0px'],
      }),
      'utf8'
    );

    const configFile = join(tempDir, 'uirig.config.json');
    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: ['./precedence.html'],
        tokensPath: './explicit-tokens.json',
        autoTokens: true,
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1024, height: 768 }],
      }),
      'utf8'
    );

    const report = await executeCheckCommand({
      cwd: tempDir,
      only: 'tokens',
      autoTokens: true,
      headless: true,
      reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
    });

    expect(report.exitCode).toBe(1);
    expect(report.summary.totalTokenViolations).toBeGreaterThan(0);
  });
  
  it('labels each viewport stanza with its active theme when options.themes is provided', async () => {
    const originalNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';

    const htmlPath = join(tempDir, 'multi-theme.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --bg: #ffffff; --fg: #111827; }
            :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
            body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); }
            main { padding: 16px; }
          </style>
        </head>
        <body><main><h1>Multi-Theme Check</h1></main></body>
      </html>`,
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
      const report = await executeCheckCommand({
        target: './multi-theme.html',
        cwd: tempDir,
        themes: ['light', 'dark'],
        spatialBrief: true,
        headless: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      });

      expect(report.exitCode).toBe(0);
      expect(report.results.map((r) => `${r.viewport.name}:${r.theme}`)).toEqual([
        'mobile:light',
        'mobile:dark',
        'desktop:light',
        'desktop:dark',
      ]);

      const consoleOut = capturedChunks.join('');
      expect(consoleOut).toContain('Target: ./multi-theme.html @ mobile (375x812) [theme: light]');
      expect(consoleOut).toContain('Target: ./multi-theme.html @ mobile (375x812) [theme: dark]');
      expect(consoleOut).toContain('Spatial Brief [mobile (375x812) [theme: light]]:');
      expect(consoleOut).toContain('Spatial Brief [mobile (375x812) [theme: dark]]:');
    } finally {
      stdoutSpy.mockRestore();
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = originalNoColor;
      }
    }
  });
  it('resolves sourceLocations for dark-mode and stress violations in --verbose console output', async () => {
    const originalNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';

    const htmlPath = join(tempDir, 'source-loc-stress-dark.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background: #0f172a; color: #f8fafc; }
            .stranded-card { width: 320px; height: 120px; padding: 16px; background: #ffffff; color: #111827; }
            .cramped-box { width: 100px; padding: 8px; background: #1e293b; color: #f8fafc; }
            .nowrap-label { display: inline-block; white-space: nowrap; }
          </style>
        </head>
        <body>
          <div class="stranded-card" data-source-loc="src/components/Card.tsx:14">Stranded light card</div>
          <div class="cramped-box">
            <span class="nowrap-label" data-source-loc="src/components/Badge.tsx:27">Expanding Label</span>
          </div>
        </body>
      </html>`,
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
      const report = await executeCheckCommand({
        target: './source-loc-stress-dark.html',
        cwd: tempDir,
        verbose: true,
        viewportsOverride: [{ name: 'desktop', width: 1280, height: 800 }],
        headless: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      });

      expect(report.exitCode).toBe(2);
      const consoleOut = capturedChunks.join('');
      expect(consoleOut).toContain('[stranded_light_surface] div.stranded-card');
      expect(consoleOut).toContain('[src/components/Card.tsx:14]');
      expect(consoleOut).toContain('[container_overflow] span.nowrap-label -> div.cramped-box');
      expect(consoleOut).toContain('[src/components/Badge.tsx:27]');
    } finally {
      stdoutSpy.mockRestore();
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = originalNoColor;
      }
    }
  });

  it('loads W3C ($value), Style Dictionary (value), and CSS custom property token files via tokensPath or options.tokensPath and guides on invalid schemas', async () => {
    const configFile = join(tempDir, 'uirig.config.json');

    // 1. W3C Design Tokens ($value) JSON
    const w3cFile = join(tempDir, 'design.tokens.json');
    writeFileSync(
      w3cFile,
      JSON.stringify({
        color: {
          surface: { $value: '#ffffff' },
          ink: { $value: '#111827' },
        },
        spacing: { md: { $value: '1rem' } },
        font: { size: { body: { $value: '16px' } } },
        radius: { sm: { $value: '4px' } },
      }),
      'utf8'
    );
    const w3cScale = loadTokenScale('./design.tokens.json', configFile);
    expect(w3cScale).toEqual({
      colors: ['rgb(255, 255, 255)', 'rgb(17, 24, 39)'],
      spacing: ['16px', '0px'],
      fontSizes: ['16px'],
      radii: ['4px', '0px'],
    });

    // 2. Style Dictionary (value) JSON
    const sdFile = join(tempDir, 'style-dict.json');
    writeFileSync(
      sdFile,
      JSON.stringify({
        color: { primary: { value: '#2563eb' } },
        size: { space: { value: '12px' } },
      }),
      'utf8'
    );
    const sdScale = loadTokenScale('./style-dict.json', configFile);
    expect(sdScale.colors).toEqual(['rgb(37, 99, 235)']);
    expect(sdScale.spacing).toEqual(['12px', '0px']);

    // 3. CSS Custom Properties (.css)
    const cssFile = join(tempDir, 'tokens.css');
    writeFileSync(
      cssFile,
      ':root { --bg: #ffffff; --fg: #111827; --space-4: 16px; --font-size-base: 16px; --radius-none: 0px; }',
      'utf8'
    );
    const cssScale = loadTokenScale('./tokens.css', configFile);
    expect(cssScale.colors).toEqual(['rgb(255, 255, 255)', 'rgb(17, 24, 39)']);
    expect(cssScale.spacing).toEqual(['16px', '0px']);

    // 4. Actionable ERR_TOKENS_SCHEMA guidance when unrecognized format is provided
    const unrecognizedFile = join(tempDir, 'unrecognized.json');
    writeFileSync(unrecognizedFile, JSON.stringify({ randomKey: 123 }), 'utf8');
    expect(() => loadTokenScale('./unrecognized.json', configFile)).toThrow(
      /Supported formats for tokensPath \/ --tokens-path/
    );

    // 5. End-to-end zero-config check with options.tokensPath pointing to CSS token file
    const htmlPath = join(tempDir, 'themed-tokens.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background: #ffffff; color: #111827; font-size: 16px; border-radius: 0px; }
          </style>
        </head>
        <body><p style="margin: 0; font-size: 16px;">Token compliant</p></body>
      </html>`,
      'utf8'
    );

    const report = await executeCheckCommand({
      target: './themed-tokens.html',
      cwd: tempDir,
      tokensPath: './tokens.css',
      only: 'tokens',
      viewportsOverride: [{ name: 'desktop', width: 1280, height: 800 }],
      headless: true,
      silentStdout: true,
      reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
    });

    expect(report.exitCode).toBe(0);
    expect(report.summary.totalTokenViolations).toBe(0);
  });

  it('validates tokensPath arrays in uirig.config.json and rejects empty or blank entries with ERR_CONFIG_SCHEMA', () => {
    const validArrayConfig = join(tempDir, 'array-tokens.config.json');
    writeFileSync(
      validArrayConfig,
      JSON.stringify({
        targetUrls: ['http://localhost:3000'],
        tokensPath: ['./src/styles/ag-tokens.css', './src/styles/ag-tokens-dark.css'],
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );

    const loaded = loadUirigConfig(validArrayConfig);
    expect(loaded.tokensPath).toEqual([
      './src/styles/ag-tokens.css',
      './src/styles/ag-tokens-dark.css',
    ]);

    const emptyArrayConfig = join(tempDir, 'empty-array.config.json');
    writeFileSync(
      emptyArrayConfig,
      JSON.stringify({
        targetUrls: ['http://localhost:3000'],
        tokensPath: [],
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );
    expect(() => loadUirigConfig(emptyArrayConfig)).toThrow(/ERR_CONFIG_SCHEMA/);

    const blankItemConfig = join(tempDir, 'blank-item.config.json');
    writeFileSync(
      blankItemConfig,
      JSON.stringify({
        targetUrls: ['http://localhost:3000'],
        tokensPath: ['./ag-tokens.css', '   '],
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );
    expect(() => loadUirigConfig(blankItemConfig)).toThrow(/ERR_CONFIG_SCHEMA/);
  });

  it('loads and merges split light + dark CSS token files via tokensPath array with 0 dark-mode token_drift violations', async () => {
    const lightTokensFile = join(tempDir, 'ag-tokens.css');
    const darkTokensFile = join(tempDir, 'ag-tokens-dark.css');
    const htmlPath = join(tempDir, 'split-theme.html');
    const configFile = join(tempDir, 'uirig.config.json');

    writeFileSync(
      lightTokensFile,
      [
        ':where(html) {',
        '  --ag-neutral-950: #010409;',
        '  --ag-neutral-50: #f0f6fc;',
        '  --ag-bg: #ffffff;',
        '  --ag-fg: #0f172a;',
        '  --ag-space-4: 16px;',
        '  --ag-font-md: 16px;',
        '  --ag-radius-none: 0px;',
        '}',
      ].join('\n'),
      'utf8'
    );

    writeFileSync(
      darkTokensFile,
      [
        '[data-theme="dark"] {',
        '  --ag-bg: var(--ag-neutral-950);',
        '  --ag-fg: var(--ag-neutral-50);',
        '}',
      ].join('\n'),
      'utf8'
    );

    const mergedScale = loadTokenScale(
      ['./ag-tokens.css', './ag-tokens-dark.css'],
      configFile
    );
    expect(mergedScale.colors).toContain('rgb(255, 255, 255)');
    expect(mergedScale.colors).toContain('rgb(15, 23, 42)');
    expect(mergedScale.colors).toContain('rgb(1, 4, 9)');
    expect(mergedScale.colors).toContain('rgb(240, 246, 252)');

    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <link rel="stylesheet" href="./ag-tokens.css" />
          <link rel="stylesheet" href="./ag-tokens-dark.css" />
          <style>
            body { margin: 0; padding: 16px; background: var(--ag-bg); color: var(--ag-fg); font-size: 16px; border-radius: 0px; }
            p { margin: 0; font-size: 16px; }
          </style>
        </head>
        <body><p>Split light and dark CSS tokens</p></body>
      </html>`,
      'utf8'
    );

    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: ['./split-theme.html'],
        tokensPath: ['./ag-tokens.css', './ag-tokens-dark.css'],
        themes: ['light', 'dark'],
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );

    const report = await executeCheckCommand({
      configPath: configFile,
      cwd: tempDir,
      only: 'tokens',
      headless: true,
      silentStdout: true,
      reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
    });

    expect(report.exitCode).toBe(0);
    expect(report.summary.totalTokenViolations).toBe(0);
  });

  it('audits full dotted IPv4 loopback URLs with subpaths intact and fails fast on truncated IPv4 URLs (Issue #53)', async () => {
    const html = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --bg: #ffffff; --fg: #111827; }
            :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
            body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font-family: sans-serif; }
          </style>
        </head>
        <body><button type="button">Loopback Button</button></body>
      </html>`;

    const { server, url } = await startFixtureServer(html);
    activeServer = server;

    const fullLoopbackUrl = `${url}/tests/uirig/poc-button.html`;
    const report = await executeCheckCommand({
      target: fullLoopbackUrl,
      cwd: tempDir,
      only: 'dom',
      viewportsOverride: [{ name: 'desktop', width: 1280, height: 800 }],
      headless: true,
      silentStdout: true,
      reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
    });

    expect(report.exitCode).toBe(0);
    expect(report.results.at(0)?.url).toBe(fullLoopbackUrl);

    await expect(
      executeCheckCommand({
        target: 'http://127.0.0',
        cwd: tempDir,
        headless: true,
        silentStdout: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      })
    ).rejects.toThrow(/ERR_INVALID_URL/);
  });

  it('runs responsive breakpoint sweep (--sweep) without extra browsers and returns exitCode 2 with failedWidths', async () => {
    const html = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 16px; font-family: sans-serif; }
            .tablet-overflow { display: none; width: 820px; height: 48px; background: #1e293b; color: #fff; }
            @media (min-width: 720px) {
              .tablet-overflow { display: block; }
            }
          </style>
        </head>
        <body>
          <div class="tablet-overflow">Breaks in 720px-800px</div>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(html);
    activeServer = server;

    const report = await executeCheckCommand({
      target: url,
      cwd: tempDir,
      sweep: '320:1440:40',
      headless: true,
      silentStdout: true,
      reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
    });

    expect(report.exitCode).toBe(2);
    expect(report.summary.totalSweepViolations).toBe(1);
    expect(report.results.at(0)?.sweepViolations?.at(0)?.failedWidths).toBe('720px-800px');
  });

  it('validates scope and exclude selector arrays in uirig.config.json and rejects non-string or blank entries with ERR_CONFIG_SCHEMA', () => {
    const validScopeConfig = join(tempDir, 'scope-exclude.config.json');
    writeFileSync(
      validScopeConfig,
      JSON.stringify({
        targetUrls: ['http://localhost:3000'],
        scope: [' #uirig-stage ', 'main.content'],
        exclude: ['h3.demo-title'],
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );

    const loaded = loadUirigConfig(validScopeConfig);
    expect(loaded.scope).toEqual(['#uirig-stage', 'main.content']);
    expect(loaded.exclude).toEqual(['h3.demo-title']);

    const badScopeConfig = join(tempDir, 'bad-scope.config.json');
    writeFileSync(
      badScopeConfig,
      JSON.stringify({
        targetUrls: ['http://localhost:3000'],
        scope: ['#uirig-stage', '   '],
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );
    expect(() => loadUirigConfig(badScopeConfig)).toThrow(/ERR_CONFIG_SCHEMA/);

    const badExcludeConfig = join(tempDir, 'bad-exclude.config.json');
    writeFileSync(
      badExcludeConfig,
      JSON.stringify({
        targetUrls: ['http://localhost:3000'],
        exclude: 'h3.demo-title',
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );
    expect(() => loadUirigConfig(badExcludeConfig)).toThrow(/ERR_CONFIG_SCHEMA/);
  });

  it('threads excludeSelectors through auditViewportInParallel across all engines and selector counting', async () => {
    const html = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background: rgb(255, 255, 255); color: rgb(17, 24, 39); font-size: 16px; }
            #uirig-stage { padding: 16px; background: rgb(243, 244, 246); border-radius: 8px; }
            .demo-title { color: rgb(210, 210, 210); padding: 13px; }
            .clean-card p { margin: 0; font-size: 16px; color: rgb(17, 24, 39); }
            :root[data-theme="dark"] body { background: rgb(17, 24, 39); color: rgb(255, 255, 255); }
            :root[data-theme="dark"] #uirig-stage { background: rgb(17, 24, 39); }
            :root[data-theme="dark"] .clean-card p { color: rgb(255, 255, 255); }
          </style>
        </head>
        <body>
          <section id="uirig-stage">
            <h3 class="demo-title">Excluded Demo Title <input placeholder="Excluded unlabeled input" /></h3>
            <div class="clean-card">
              <p>In-scope compliant content</p>
            </div>
          </section>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(html);
    activeServer = server;

    const pool = new WarmBrowserPool({ headless: true, idleTimeoutMs: 60_000 });
    try {
      const browser = await pool.acquire();
      const report = await auditViewportInParallel(
        browser,
        url,
        { name: 'desktop', width: 1280, height: 800 },
        FALLBACK_TOKEN_SCALE,
        ZERO_CONFIG_DEFAULTS.thresholdBudgets,
        undefined,
        [],
        false,
        ['#uirig-stage', '.demo-title'],
        false,
        false,
        undefined,
        tempDir,
        undefined,
        ['.demo-title']
      );

      expect(report.scopedSelectors).toEqual(['#uirig-stage', '.demo-title']);
      expect(report.excludedSelectors).toEqual(['.demo-title']);
      expect(report.matchedSelectorCount).toBe(1);
      expect(report.tokenViolations).toHaveLength(0);
      expect(report.contrastViolations).toHaveLength(0);
      expect(report.darkModeViolations).toHaveLength(0);
      expect(report.stressViolations).toHaveLength(0);
      expect(report.domViolations).toHaveLength(0);
    } finally {
      await pool.dispose();
    }
  });

  it('applies scope and exclude from uirig.config.json and options, carves out excluded subtrees, and rejects invalid exclude selectors', async () => {
    const html = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --bg: #ffffff; --fg: #111827; }
            :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
            body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font-family: sans-serif; }
            .host-shell .bad-contrast { color: rgb(210, 210, 210); }
            #uirig-stage h3.demo-title { color: rgb(210, 210, 210); }
            #uirig-stage p.valid-copy { margin: 0; font-size: 16px; }
          </style>
        </head>
        <body>
          <header class="host-shell">
            <span class="bad-contrast">Host shell noise outside --scope</span>
          </header>
          <section id="uirig-stage">
            <h3 class="demo-title">Carved-out demo heading</h3>
            <p class="valid-copy">Audited stage copy</p>
          </section>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(html);
    activeServer = server;

    const configFile = join(tempDir, 'uirig.config.json');
    writeFileSync(
      configFile,
      JSON.stringify({
        targetUrls: [url],
        scope: ['#uirig-stage'],
        exclude: ['h3.demo-title'],
        thresholdBudgets: {
          clsMaxLimit: 0.1,
          overflowPixelTolerance: 2,
          touchTargetMinSpacingPx: 24,
        },
        viewports: [{ name: 'desktop', width: 1280, height: 800 }],
      }),
      'utf8'
    );

    const configScopedReport = await executeCheckCommand({
      configPath: configFile,
      cwd: tempDir,
      headless: true,
      silentStdout: true,
      reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
    });

    expect(configScopedReport.exitCode).toBe(0);
    expect(configScopedReport.results.at(0)?.scopedSelectors).toEqual(['#uirig-stage']);
    expect(configScopedReport.results.at(0)?.excludedSelectors).toEqual(['h3.demo-title']);
    expect(configScopedReport.results.at(0)?.matchedSelectorCount).toBe(1);

    await expect(
      executeCheckCommand({
        target: url,
        cwd: tempDir,
        exclude: ['div > > .invalid-exclude'],
        headless: true,
        silentStdout: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      })
    ).rejects.toThrow(/ERR_INVALID_SELECTOR/);
  });

  it('supports document-wide --exclude carve-outs when --scope is omitted', async () => {
    const html = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --bg: #ffffff; --fg: #111827; }
            :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
            body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font-family: sans-serif; }
            .legacy-banner .low-contrast { color: rgb(210, 210, 210); }
          </style>
        </head>
        <body>
          <div class="legacy-banner">
            <span class="low-contrast">Excluded globally</span>
            <input placeholder="Excluded globally" />
          </div>
          <main>
            <p>Compliant main content</p>
          </main>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(html);
    activeServer = server;

    const report = await executeCheckCommand({
      target: url,
      cwd: tempDir,
      exclude: ['.legacy-banner'],
      viewportsOverride: [{ name: 'desktop', width: 1280, height: 800 }],
      headless: true,
      silentStdout: true,
      reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
    });

    expect(report.exitCode).toBe(0);
    expect(report.results.at(0)?.scopedSelectors).toBeUndefined();
    expect(report.results.at(0)?.excludedSelectors).toEqual(['.legacy-banner']);
    expect(report.summary.totalContrastViolations).toBe(0);
    expect(report.summary.totalDomViolations).toBe(0);
  });

  it('catches click-occluded controls and missing :focus-visible indicators via --only=states and returns exitCode 1', async () => {
    const html = `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background: #ffffff; color: #0f172a; font-family: sans-serif; }
            .stack { position: relative; width: 180px; height: 44px; margin-bottom: 12px; }
            .stack button, .stack .shield { position: absolute; inset: 0; width: 100%; height: 100%; }
            .shield { opacity: 0; z-index: 5; }
            button.no-ring { outline: none; border: 1px solid #cbd5e1; background: #ffffff; padding: 8px 14px; }
            button.no-ring:focus-visible { outline: none; }
          </style>
        </head>
        <body>
          <div class="stack">
            <button id="blocked-cta">Blocked CTA</button>
            <div class="shield"></div>
          </div>
          <button id="unfocused-cta" class="no-ring">No Focus Ring</button>
        </body>
      </html>`;

    const { server, url } = await startFixtureServer(html);
    activeServer = server;

    const report = await executeCheckCommand({
      target: url,
      only: 'states',
      cwd: tempDir,
      viewportsOverride: [{ name: 'desktop', width: 1280, height: 800 }],
      headless: true,
      silentStdout: true,
      reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
    });

    expect(report.exitCode).toBe(1);
    expect(report.summary.totalStateViolations).toBe(2);
    expect(report.results.at(0)?.stateViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          violationType: 'click_occluded',
          selector: 'button#blocked-cta',
        }),
        expect.objectContaining({
          violationType: 'missing_focus_visible',
          selector: 'button#unfocused-cta',
        }),
      ])
    );
  });

});
