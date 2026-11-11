/**
 * tests/unit/crawler.test.ts
 * Unit tests validating directory crawler exclusion boundaries.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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

  it('==> Should explicitly exclude the isolated playground/ sandbox when present on disk', () => {
    console.log('\n::: RUNNING UNIT CHECKS: Asserting Playground Sandbox Isolation :::');

    // Create a clean temporary directory on disk to test physical directory pruning deterministically
    const tempWorkspace = mkdtempSync(join(tmpdir(), 'uirig-crawler-playground-'));

    try {
      // Populate both allowed project entries and a physical `playground/` directory with nested files
      mkdirSync(join(tempWorkspace, 'src'));
      writeFileSync(join(tempWorkspace, 'src', 'index.ts'), 'export {};\n', 'utf8');
      mkdirSync(join(tempWorkspace, 'playground'));
      writeFileSync(join(tempWorkspace, 'playground', 'index.html'), '<!doctype html>\n', 'utf8');

      expect(BLOCKLIST_DIRECTORIES.has('playground')).toBe(true);

      const scannedTree = generateDirectoryTree(tempWorkspace);
      const scannedNames = scannedTree.children?.map((child) => child.name) ?? [];

      // Verify legitimate source folders remain intact while `playground` is completely pruned
      expect(scannedNames).toContain('src');
      expect(scannedNames).not.toContain('playground');

      console.log('[+] Verified: `playground/` sandbox is strictly isolated from repository crawls.');
    } finally {
      // Always clean up temporary test artifacts regardless of assertion outcome
      rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });
});
