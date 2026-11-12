/**
 * tests/unit/formatter.test.ts
 * 1-to-1 unit tests for `src/utils/formatter.ts`.
 * Verifies ANSI escape code wrapping, `NO_COLOR` / `UIRIG_JSON_MODE` suppression,
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

  it('suppresses all ANSI escape codes when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';

    console.log('\n--- START TEST: NO_COLOR Environment Suppression ---');
    expect(isColorDisabled()).toBe(true);
    expect(paint('7 FAIL', 'bold', 'red')).toBe('7 FAIL');
    expect(formatTelemetryLog('tokens:audit', 'Starting crawl')).toBe(
      '[tokens:audit] Starting crawl'
    );
  });

  it('suppresses all ANSI escape codes when UIRIG_JSON_MODE is enabled', () => {
    delete process.env.NO_COLOR;
    process.env.UIRIG_JSON_MODE = '1';

    console.log('\n--- START TEST: UIRIG_JSON_MODE Suppression ---');
    expect(isColorDisabled()).toBe(true);
    expect(formatTelemetryLog('matrix:audit', 'Contrast check')).toBe(
      '[matrix:audit] Contrast check'
    );
  });

  it('applies distinct color badges for all 4 core telemetry domains', () => {
    delete process.env.NO_COLOR;
    delete process.env.UIRIG_JSON_MODE;

    console.log('\n--- START TEST: Distinct Domain Badge Colors ---');
    const tokensLog = formatTelemetryLog('tokens:audit', 'Crawl started');
    const matrixLog = formatTelemetryLog('matrix:audit', 'Contrast started');
    const adversaryLog = formatTelemetryLog('adversary:stress', 'Stress started');
    const clsLog = formatTelemetryLog('cls:monitor', 'CLS started');

    expect(tokensLog).toContain(ANSI_CODES.magenta);
    expect(matrixLog).toContain(ANSI_CODES.cyan);
    expect(adversaryLog).toContain(ANSI_CODES.yellow);
    expect(clsLog).toContain(ANSI_CODES.blue);
  });

  it('routes logTelemetry to stdout normally and to stderr when UIRIG_JSON_MODE is active', () => {
    delete process.env.NO_COLOR;
    delete process.env.UIRIG_JSON_MODE;

    console.log('\n--- START TEST: Unix stdout vs. stderr Telemetry Stream Routing ---');
    const stdoutLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stderrLogSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Normal CLI mode -> console.log (stdout)
    logTelemetry('check:dispatch', 'Normal run');
    expect(stdoutLogSpy).toHaveBeenCalledTimes(1);
    expect(stderrLogSpy).not.toHaveBeenCalled();

    // Agentic JSON mode -> console.error (stderr), leaving stdout completely untouched
    process.env.UIRIG_JSON_MODE = '1';
    logTelemetry('check:dispatch', 'Agentic JSON run');
    expect(stdoutLogSpy).toHaveBeenCalledTimes(1);
    expect(stderrLogSpy).toHaveBeenCalledWith('[check:dispatch] Agentic JSON run');
  });
});
