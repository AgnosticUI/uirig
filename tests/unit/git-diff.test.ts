/**
 * tests/unit/git-diff.test.ts
 * Unit specs for Incremental Git-Diff Component Scoping (`--changed` / `--base <ref>`) (Issue #14).
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  inferSelectorsFromFile,
  resolveChangedComponentSelectors,
} from '../../src/core/git-diff.js';

describe('::: ISSUE #14 (CHUNK 1): INCREMENTAL GIT-DIFF COMPONENT SCOPING :::', () => {
  it('==> Should infer custom element tags from customElements.define, @customElement, stylesheets, and filenames', () => {
    expect(
      inferSelectorsFromFile(
        'src/components/Button.ts',
        `export class AgButton extends HTMLElement {}
customElements.define('ag-button', AgButton);`
      )
    ).toEqual(['ag-button']);

    expect(
      inferSelectorsFromFile(
        'src/components/Card.ts',
        `@customElement('ag-ticket-card')
export class AgTicketCard extends LitElement {}`
      )
    ).toEqual(['ag-ticket-card']);

    expect(
      inferSelectorsFromFile('src/components/ag-pricing-card.css', '.wrapper { color: red; }')
    ).toEqual(['ag-pricing-card']);

    // Non-hyphenated utility file without custom element definition returns []
    expect(inferSelectorsFromFile('src/utils/format.ts', 'export const x = 1;')).toEqual([]);
  });

  it('==> Should detect modified UI components in a Git repo (working tree and --base main)', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-git-diff-'));
    try {
      execFileSync('git', ['init', '-b', 'main'], { cwd: tempDir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir, stdio: 'ignore' });

      mkdirSync(join(tempDir, 'src', 'components'), { recursive: true });
      writeFileSync(
        join(tempDir, 'src', 'components', 'ag-header.ts'),
        `customElements.define('ag-header', class extends HTMLElement {});\n`,
        'utf8'
      );
      writeFileSync(join(tempDir, 'README.md'), '# Initial\n', 'utf8');
      execFileSync('git', ['add', '.'], { cwd: tempDir, stdio: 'ignore' });
      execFileSync('git', ['commit', '-m', 'chore: initial'], { cwd: tempDir, stdio: 'ignore' });

      // Create feature branch and modify ag-badge.ts
      execFileSync('git', ['checkout', '-b', 'feat/badge'], { cwd: tempDir, stdio: 'ignore' });
      writeFileSync(
        join(tempDir, 'src', 'components', 'Badge.ts'),
        `@customElement('ag-status-badge')\nexport class Badge {}\n`,
        'utf8'
      );
      execFileSync('git', ['add', '.'], { cwd: tempDir, stdio: 'ignore' });
      execFileSync('git', ['commit', '-m', 'feat: add status badge'], { cwd: tempDir, stdio: 'ignore' });

      // Diff against `--base main` finds `ag-status-badge` and ignores untouched `ag-header`
      const branchResolution = resolveChangedComponentSelectors(tempDir, 'main');
      expect(branchResolution.isGitRepo).toBe(true);
      expect(branchResolution.changedUiFiles).toEqual(['src/components/Badge.ts']);
      expect(branchResolution.inferredSelectors).toEqual(['ag-status-badge']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
