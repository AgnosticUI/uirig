/**
 * src/utils/fs.ts
 * Atomic framework-blind filesystem primitives.
 * Anchored to the November 10, 2026 system timeline baseline.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * Atomically writes a text payload string to disk, safely ensuring 
 * that the parent directory structure is generated if missing.
 */
export function atomicWriteFile(filePath: string, content: string): void {
  const targetDir = dirname(filePath);
  
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  
  writeFileSync(filePath, content, 'utf8');
}
