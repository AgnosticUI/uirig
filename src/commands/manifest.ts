/**
 * src/commands/manifest.ts
 * CLI process handler executing repository tree crawls.
 * Anchored to the November 10, 2026 system timeline baseline.
 */

import { generateDirectoryTree, serializeTreeToAscii } from '../core/crawler.js';

export async function executeManifestCommand(): Promise<void> {
  console.log('\n::: GENERATING WORKSPACE FILE BLUEPRINT MANIFEST :::');
  
  try {
    const rootTree = generateDirectoryTree(process.cwd());
    const asciiTrace = serializeTreeToAscii(rootTree);
    
    console.log(asciiTrace);
    console.log('::: BLUEPRINT COMPILATION COMPLETE :::');
  } catch (error: any) {
    console.error(`[!] Manifest Compilation Crash: ${error.message}`);
    process.exit(1);
  }
}
