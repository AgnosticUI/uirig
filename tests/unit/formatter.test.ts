/**
 * tests/unit/formatter.test.ts
 * 1-to-1 unit tests for `src/utils/formatter.ts`.
 * Verifies ANSI escape code wrapping, `NO_COLOR` suppression,
 * preservation of ANSI colors on `stderr` during `UIRIG_JSON_MODE`,
 * domain-specific telemetry badge styling, and `stdout` vs. `stderr` stream routing.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  ANSI_CODES,
  isColorDisabled,
  paint,
  formatTelemetryLog,
  logTelemetry,
} from '../../src/utils/formatter.js';

describe('formatter.ts — Terminal Styler & Telemetry Stream Router', () => {
  const originalNoColor = process.env.NO_COLOR;
  const originalJsonMode = process.env.UIRIG_JSON_MODE;

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalNoColor;
    }

    if (originalJsonMode === undefined) {
      delete process.env.UIRIG_JSON_MODE;
    } else {
      process.env.UIRIG_JSON_MODE = originalJsonMode;
    }
  });

  it('wraps text with requested ANSI codes and terminates with reset', () => {
    delete process.env.NO_COLOR;
    delete process.env.UIRIG_JSON_MODE;

    console.log('\n--- START TEST: ANSI Escape Wrapping ---');
    const output = paint('7 FAIL', 'bold', 'red');

    expect(output).toBe(`${ANSI_CODES.bold}${ANSI_CODES.red}7 FAIL${ANSI_CODES.reset}`);
  });

  it('returns unstyled plain text when no styles are passed', () => {
    delete process.env.NO_COLOR;
    delete process.env.UIRIG_JSON_MODE;

    console.log('\n--- START TEST: No-Op Paint Without Styles ---');
    expect(paint('plain text')).toBe('plain text');
  });

  it('suppresses all ANSI escape codes when NO_COLOR is set (even in JSON mode)', () => {
    process.env.NO_COLOR = '1';
    process.env.UIRIG_JSON_MODE = '1';

    console.log('\n--- START TEST: NO_COLOR Environment Suppression ---');
    expect(isColorDisabled()).toBe(true);
    expect(paint('7 FAIL', 'bold', 'red')).toBe('7 FAIL');
    expect(formatTelemetryLog('tokens:audit', 'Starting crawl')).toBe(
      '[tokens:audit] Starting crawl'
    );
  });

  it('preserves ANSI color badges when UIRIG_JSON_MODE is enabled and NO_COLOR is unset', () => {
    delete process.env.NO_COLOR;
    process.env.UIRIG_JSON_MODE = '1';

    console.log('\n--- START TEST: Preserve ANSI Colors Under UIRIG_JSON_MODE ---');
    expect(isColorDisabled()).toBe(false);
    const styled = formatTelemetryLog('matrix:audit', 'Contrast check');
    expect(styled).toContain(ANSI_CODES.cyan);
    expect(styled).toContain(ANSI_CODES.reset);
  });

  it('applies distinct color badges for core telemetry domains', () => {
    delete process.env.NO_COLOR;
    delete process.env.UIRIG_JSON_MODE;

    console.log('\n--- START TEST: Distinct Domain Badge Colors ---');
    const tokensLog = formatTelemetryLog('tokens:audit', 'Crawl started');
    const matrixLog = formatTelemetryLog('matrix:audit', 'Contrast started');
    const darkModeLog = formatTelemetryLog('dark-mode:audit', 'Dark mode started');
    const adversaryLog = formatTelemetryLog('adversary:stress', 'Stress started');
    const clsLog = formatTelemetryLog('cls:monitor', 'CLS started');
    const domLog = formatTelemetryLog('dom:audit', 'DOM check started');

    expect(tokensLog).toContain(ANSI_CODES.magenta);
    expect(matrixLog).toContain(ANSI_CODES.cyan);
    expect(darkModeLog).toContain(ANSI_CODES.cyan);
    expect(adversaryLog).toContain(ANSI_CODES.yellow);
    expect(clsLog).toContain(ANSI_CODES.blue);
    expect(domLog).toContain(ANSI_CODES.red);
  });

  it('routes logTelemetry to stdout normally and colored logs to stderr when UIRIG_JSON_MODE is active', () => {
    delete process.env.NO_COLOR;
    delete process.env.UIRIG_JSON_MODE;

    console.log('\n--- START TEST: Unix stdout vs. stderr Telemetry Stream Routing ---');
    const stdoutLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stderrLogSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Normal CLI mode -> console.log (stdout)
    logTelemetry('check:dispatch', 'Normal run');
    expect(stdoutLogSpy).toHaveBeenCalledTimes(1);
    expect(stderrLogSpy).not.toHaveBeenCalled();

    // Agentic JSON mode -> console.error (stderr) with ANSI colors preserved, leaving stdout untouched
    process.env.UIRIG_JSON_MODE = '1';
    logTelemetry('check:dispatch', 'Agentic JSON run');
    expect(stdoutLogSpy).toHaveBeenCalledTimes(1);
    expect(stderrLogSpy).toHaveBeenCalledWith(
      `${ANSI_CODES.bold}${ANSI_CODES.green}[check:dispatch]${ANSI_CODES.reset} Agentic JSON run`
    );
  });
});
