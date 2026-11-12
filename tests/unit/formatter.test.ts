/**
 * tests/unit/formatter.test.ts
 * 1-to-1 unit tests for `src/utils/formatter.ts`.
 * Verifies ANSI escape code wrapping, `NO_COLOR` / `UIRIG_JSON_MODE` suppression,
 * and domain-specific telemetry badge styling across all 4 core tools.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  ANSI_CODES,
  isColorDisabled,
  paint,
  formatTelemetryLog,
} from '../../src/utils/formatter.js';

describe('formatter.ts — Terminal Styler & Telemetry Formatter', () => {
  const originalNoColor = process.env.NO_COLOR;
  const originalJsonMode = process.env.UIRIG_JSON_MODE;

  afterEach(() => {
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

    console.log('[test:formatter] Verifying bold red ANSI escape wrapping...');
    const output = paint('7 FAIL', 'bold', 'red');

    expect(output).toBe(`${ANSI_CODES.bold}${ANSI_CODES.red}7 FAIL${ANSI_CODES.reset}`);
  });

  it('returns unstyled plain text when no styles are passed', () => {
    delete process.env.NO_COLOR;
    delete process.env.UIRIG_JSON_MODE;

    console.log('[test:formatter] Verifying no-op paint() when styles array is empty...');
    expect(paint('plain text')).toBe('plain text');
  });

  it('suppresses all ANSI escape codes when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';

    console.log('[test:formatter] Verifying NO_COLOR environment suppression...');
    expect(isColorDisabled()).toBe(true);
    expect(paint('7 FAIL', 'bold', 'red')).toBe('7 FAIL');
    expect(formatTelemetryLog('tokens:audit', 'Starting crawl')).toBe(
      '[tokens:audit] Starting crawl'
    );
  });

  it('suppresses all ANSI escape codes when UIRIG_JSON_MODE is enabled', () => {
    delete process.env.NO_COLOR;
    process.env.UIRIG_JSON_MODE = '1';

    console.log('[test:formatter] Verifying UIRIG_JSON_MODE suppression for agentic JSON streams...');
    expect(isColorDisabled()).toBe(true);
    expect(formatTelemetryLog('matrix:audit', 'Contrast check')).toBe(
      '[matrix:audit] Contrast check'
    );
  });

  it('applies distinct color badges for all 4 core telemetry domains', () => {
    delete process.env.NO_COLOR;
    delete process.env.UIRIG_JSON_MODE;

    console.log('[test:formatter] Verifying distinct domain tag colors across all 4 engines...');
    const tokensLog = formatTelemetryLog('tokens:audit', 'Crawl started');
    const matrixLog = formatTelemetryLog('matrix:audit', 'Contrast started');
    const adversaryLog = formatTelemetryLog('adversary:stress', 'Stress started');
    const clsLog = formatTelemetryLog('cls:monitor', 'CLS started');

    expect(tokensLog).toContain(ANSI_CODES.magenta);
    expect(matrixLog).toContain(ANSI_CODES.cyan);
    expect(adversaryLog).toContain(ANSI_CODES.yellow);
    expect(clsLog).toContain(ANSI_CODES.blue);
  });
});
