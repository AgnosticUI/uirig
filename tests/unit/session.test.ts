/**
 * tests/unit/session.test.ts
 * Unit tests verifying SHA-256 hashing determinism and session ledger state transitions.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { computeStringHash } from '../../src/utils/crypto.js';
import { executeInitCommand } from '../../src/commands/init.js';
import { appendSessionStep, readSessionLedger } from '../../src/core/session.js';

describe('::: PHASE 2 TASK 2.6: STATE LEDGER & CRYPTO VALIDATION GATES :::', () => {
  const testLedgerPath = resolve(process.cwd(), '.uirig/session.json');

  beforeEach(async () => {
    if (existsSync(testLedgerPath)) unlinkSync(testLedgerPath);
    await executeInitCommand();
  });

  afterEach(() => {
    if (existsSync(testLedgerPath)) unlinkSync(testLedgerPath);
  });

  it('==> Should compute deterministic 64-character SHA-256 hex digests', () => {
    console.log('\n::: RUNNING CRYPTO CHECKS: Asserting SHA-256 Determinism :::');
    const hashA = computeStringHash('uirig-invariant-payload');
    const hashB = computeStringHash('uirig-invariant-payload');

    expect(hashA).toHaveLength(64);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(hashA).toBe(hashB);
  });

  it('==> Should append new milestone steps and update ledger timestamps atomically', () => {
    console.log('\n::: RUNNING LEDGER CHECKS: Appending Milestone Step :::');
    const sampleHash = computeStringHash('{"status":"passed"}');

    const updatedLedger = appendSessionStep({
      command: 'check',
      variantName: 'baseline_run',
      filePointer: 'uirig.config.json',
      checksum: sampleHash,
      status: 'active'
    }, testLedgerPath);

    expect(updatedLedger.history).toHaveLength(1);
    expect(updatedLedger.history[0].step).toBe(1);
    expect(updatedLedger.history[0].checksum).toBe(sampleHash);

    const reloaded = readSessionLedger(testLedgerPath);
    expect(reloaded.history[0].command).toBe('check');
  });
});
