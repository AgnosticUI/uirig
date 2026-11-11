/**
 * tests/unit/crawler.test.ts
 * Unit tests validating directory crawler exclusion boundaries.
 */
import { describe, it, expect } from 'vitest';
import { generateDirectoryTree, BLOCKLIST_DIRECTORIES } from '../../src/core/crawler.js';

describe('::: PHASE 2 TASK 2.5: CRAWLER SUBSET VALIDATION GATES :::', () => {

  it('==> Should scan current repository root and filter out blocklisted directories', () => {
    console.log('\n::: RUNNING UNIT CHECKS: Asserting Spider Exclusion Pruning :::');
    
    const rootTree = generateDirectoryTree(process.cwd());
    expect(rootTree.type).toBe('directory');
    
    const childNames = rootTree.children?.map(child => child.name) ?? [];
    
    expect(childNames).toContain('src');
    expect(childNames).toContain('tests');
    expect(childNames).toContain('package.json');
    
    // Assert dynamically against every entry in BLOCKLIST_DIRECTORIES
    for (const blockedDir of BLOCKLIST_DIRECTORIES) {
      expect(childNames).not.toContain(blockedDir);
    }
    
    console.log('[+] Spider successfully navigated tree limits while dropping all blocklisted folders.');
  });
});
