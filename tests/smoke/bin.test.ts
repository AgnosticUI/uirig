/**
 * tests/smoke/bin.test.ts
 * Smoke tests confirming global binary linkage and environment initialization bounds.
 * Anchored directly to the November 10, 2026 system timeline baseline.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('::: PHASE 2 TASK 2.1: ENVIRONMENT SCAFFOLDING GATES :::', () => {

  it('==> Should verify the global binary routing file exists on disk', () => {
    const binPath = resolve(process.cwd(), 'bin/uirig');
    console.log(`\n::: SYSTEM CHECK: Verifying file availability at ${binPath} :::`);
    expect(existsSync(binPath)).toBe(true);
  });

  it('==> Should verify package manifest parameters enforce explicit ESM behavior', async () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    
    // Upgraded from 'assert' to modern ECMA Import Attributes ('with')
    const pkg = await import(pkgPath, { with: { type: 'json' } });
    
    console.log('[+] Manifest configuration read. Asserting ESM and Binary symbols...');
    expect(pkg.default.type).toBe('module');
    expect(pkg.default.bin.uirig).toBe('./bin/uirig');
  });
});
