/**
 * tests/unit/session.test.ts
 * Unit tests verifying SHA-256 hashing determinism and session ledger state transitions.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { computeStringHash } from '../../src/utils/crypto.js';
import { atomicWriteFile } from '../../src/utils/fs.js';
import { appendSessionStep, readSessionLedger, type ISessionManifest } from '../../src/core/session.js';

describe('::: PHASE 2 TASK 2.6: STATE LEDGER & CRYPTO VALIDATION GATES :::', () => {
  // Use an isolated ledger path so parallel worker threads running init.test.ts never collide
  const testLedgerPath = resolve(process.cwd(), '.uirig/session.test.json');

  beforeEach(() => {
    if (existsSync(testLedgerPath)) unlinkSync(testLedgerPath);

    const seedManifest: ISessionManifest = {
      $schema: 'http://json-schema.org',
      sessionId: '00000000-0000-4000-8000-000000000001',
      meta: {
        platform: process.platform,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      history: [],
    };

    atomicWriteFile(testLedgerPath, JSON.stringify(seedManifest, null, 2));
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
    const [firstEntry] = updatedLedger.history;
    expect(firstEntry?.step).toBe(1);
    expect(firstEntry?.checksum).toBe(sampleHash);

    const reloaded = readSessionLedger(testLedgerPath);
    const [reloadedEntry] = reloaded.history;
    expect(reloadedEntry?.command).toBe('check');
  });
});
