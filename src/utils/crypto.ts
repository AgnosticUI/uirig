/**
 * src/utils/crypto.ts
 * Deterministic SHA-256 file and buffer hashing primitives.
 * Anchored to the November 10, 2026 system timeline baseline.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';

/**
 * Computes a deterministic 64-character lowercase SHA-256 hex digest for a UTF-8 string.
 */
export function computeStringHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Reads a file from disk and computes its deterministic SHA-256 hex digest.
 */
export function computeFileHash(filePath: string): string {
  const fileBuffer = readFileSync(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}
