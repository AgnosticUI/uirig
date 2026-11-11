/**
 * tests/unit/init.test.ts
 * Verification unit suite asserting uirig init populates file primitives accurately.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, rmSync } from 'fs';
import { resolve } from 'path';
import { executeInitCommand } from '../../src/commands/init.js';

describe('::: PHASE 2 TASK 2.4: INITIALIZER RUNTIME CHECKS :::', () => {
  const configPath = resolve(process.cwd(), 'uirig.config.json');
  const ledgerPath = resolve(process.cwd(), '.uirig/session.json');

  beforeEach(() => {
    // Clean environment triggers to avoid state pollution
    if (existsSync(configPath)) unlinkSync(configPath);
    if (existsSync(ledgerPath)) unlinkSync(ledgerPath);
  });

  it('==> Should generate structural configuration assets and ledgers cleanly on disk', async () => {
    expect(existsSync(configPath)).toBe(false);
    expect(existsSync(ledgerPath)).toBe(false);

    await executeInitCommand();

    expect(existsSync(configPath)).toBe(true);
    expect(existsSync(ledgerPath)).toBe(true);

    // Verify tolerance thresholds are correctly locked into the output JSON definition
    const configData = await import(configPath, { with: { type: 'json' } });
    expect(configData.default.thresholdBudgets.overflowPixelTolerance).toBe(2);
    expect(configData.default.thresholdBudgets.clsMaxLimit).toBe(0.1);
  });
});
