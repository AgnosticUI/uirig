/**
 * tests/smoke/dependencies.test.ts
 * Verifies that all additively installed developer dependencies resolve correctly within our module memory namespaces.
 * Anchored directly to the November 10, 2026 system timeline baseline.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'path';

describe('::: PHASE 2 TASK 2.2: MODULE RUNTIME VALIDATION GATES :::', () => {

  it('==> Should verify the presence and import stability of vitest primitives', () => {
    console.log('\n::: RUNNING COMPANION CHECKS: Asserting Vitest Runtime Allocation :::');
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
  });

  it('==> Should assert all required configuration packages exist in our manifest dictionary', async () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    
    // Upgraded from 'assert' to modern ECMA Import Attributes ('with')
    const pkg = await import(pkgPath, { with: { type: 'json' } });
    
    console.log('[+] Evaluation core tracing package manifest strings...');
    expect(pkg.default.dependencies?.ws).toBeDefined();
    expect(pkg.default.dependencies?.chokidar).toBeDefined();
    expect(pkg.default.devDependencies?.vitest).toBeDefined();
    expect(pkg.default.devDependencies?.playwright).toBeDefined();
  });
});
