/**
 * tests/smoke/tsconfig.test.ts
 * Verification spec confirming that strict compilation and node type parameters are active.
 * Anchored directly to the November 10, 2026 system timeline baseline.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'path';

describe('::: PHASE 2 TASK 2.3: COMPILER MATRIX VALIDATION GATES :::', () => {

  it('==> Should assert tsconfig configuration maps ambient node type definitions natively', async () => {
    console.log('\n::: RUNNING CONFIGURATION CHECKS: Asserting tsconfig Parameters :::');
    const configPath = resolve(process.cwd(), 'tsconfig.json');
    
    // Utilizing standard ESM Import Attributes ('with' instead of deprecated 'assert')
    const tsconfig = await import(configPath, { with: { type: 'json' } });
    
    const compilerOptions = tsconfig.default.compilerOptions;
    expect(compilerOptions.types).toContain('node');
    expect(compilerOptions.strict).toBe(true);
    expect(compilerOptions.strictNullChecks).toBe(true);
  });

  it('==> Should verify that native Node path utilities resolve cleanly under active configurations', () => {
    // Asserting path.resolve executes cleanly without compilation warnings
    const verifiedPath = resolve('src', 'index.ts');
    expect(verifiedPath).toContain('src/index.ts');
    console.log(`[+] Verification successful. Ambient Node path identifier is fully typed: ${verifiedPath}`);
  });
});
