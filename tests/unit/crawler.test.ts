/**
 * tests/unit/crawler.test.ts
 * Unit tests validating directory crawler exclusion boundaries.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { generateDirectoryTree } from '../../src/core/crawler.js';

describe('::: PHASE 2 TASK 2.5: CRAWLER SUBSET VALIDATION GATES :::', () => {

  it('==> Should scan current repository root and filter out blocklisted directories', () => {
    console.log('\n::: RUNNING UNIT CHECKS: Asserting Spider Exclusion Pruning :::');
    
    const rootTree = generateDirectoryTree(process.cwd());
    expect(rootTree.type).toBe('directory');
    
    // Find children names inside the parsed root dictionary map
    const childNames = rootTree.children?.map(child => child.name) ?? [];
    
    expect(childNames).toContain('src');
    expect(childNames).toContain('tests');
    expect(childNames).toContain('package.json');
    
    // Assert that the crawler systematically dropped the deep blackhole folders
    expect(childNames).not.toContain('node_modules');
    expect(childNames).not.toContain('.git');
    
    console.log('[+] Spider successfully navigated tree limits while dropping blackholes.');
  });
});
