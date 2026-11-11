/**
 * src/core/session.ts
 * Local transaction ledger manager and chronological state logger.
 * Anchored to the November 10, 2026 system timeline baseline.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { atomicWriteFile } from '../utils/fs.js';

export interface ISessionHistoryEntry {
  step: number;
  command: string;
  variantName: string;
  filePointer: string;
  checksum: string;
  timestamp: string;
  status: 'stable' | 'active' | 'drifting';
}

export interface ISessionManifest {
  $schema: string;
  sessionId: string;
  meta: {
    platform: string;
    createdAt: string;
    updatedAt: string;
  };
  history: ISessionHistoryEntry[];
}

/**
 * Reads and validates the structural integrity of .uirig/session.json.
 */
export function readSessionLedger(ledgerPath: string = resolve(process.cwd(), '.uirig/session.json')): ISessionManifest {
  if (!existsSync(ledgerPath)) {
    throw new Error(`ERR_SESSION_MISSING: Ledger not found at ${ledgerPath}. Run 'uirig init' first.`);
  }

  const rawData = readFileSync(ledgerPath, 'utf8');
  const parsed = JSON.parse(rawData) as ISessionManifest;

  if (!parsed.sessionId || !parsed.meta || !Array.isArray(parsed.history)) {
    throw new Error('ERR_SESSION_CORRUPT: session.json failed structural schema validation.');
  }

  return parsed;
}

/**
 * Appends a verified execution milestone to .uirig/session.json and updates meta timestamps.
 */
export function appendSessionStep(
  entry: Omit<ISessionHistoryEntry, 'step' | 'timestamp'>,
  ledgerPath: string = resolve(process.cwd(), '.uirig/session.json')
): ISessionManifest {
  const ledger = readSessionLedger(ledgerPath);
  const now = new Date().toISOString();

  // Demote previous active entries to stable
  for (const item of ledger.history) {
    if (item.status === 'active') {
      item.status = 'stable';
    }
  }

  const nextStepNumber = ledger.history.length + 1;
  ledger.history.push({
    ...entry,
    step: nextStepNumber,
    timestamp: now
  });

  ledger.meta.updatedAt = now;
  atomicWriteFile(ledgerPath, JSON.stringify(ledger, null, 2));

  console.log(`::: LEDGER UPDATED: Step ${nextStepNumber} [${entry.command}] recorded cleanly :::`);
  return ledger;
}
