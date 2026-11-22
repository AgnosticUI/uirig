/**
 * tests/unit/git-diff.test.ts
 * Unit & E2E specs for Incremental Git-Diff Component Scoping (`--changed` / `--base <ref>`)
 * and `changedPaths` (`include` / `exclude` globs) (Issue #14).
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  inferSelectorsFromFile,
  isUiComponentFile,
  resolveChangedComponentSelectors,
} from '../../src/core/git-diff.js';
import { executeCheckCommand } from '../../src/commands/check.js';
import { parseCliArgs } from '../../src/index.js';

describe('::: ISSUE #14: INCREMENTAL GIT-DIFF COMPONENT SCOPING & CHANGED PATHS :::', () => {
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

    expect(inferSelectorsFromFile('src/utils/format.ts', 'export const x = 1;')).toEqual([]);
  });

  it('==> Should support server-rendered templates (.erb, .jinja2) and custom changedPaths include/exclude globs', () => {
    expect(isUiComponentFile('app/views/tickets/show.html.erb')).toBe(true);
    expect(isUiComponentFile('templates/partials/drawer.jinja2')).toBe(true);

    const pathsConfig = {
      include: ['src/components/**', 'src/app/**/_components/**', 'server/views/*.py'],
      exclude: ['src/toys/**', 'src/experimental/**'],
    };
    expect(isUiComponentFile('src/toys/components/Demo.tsx', pathsConfig)).toBe(false);
    expect(isUiComponentFile('src/experimental/codez/Scratch.ts', pathsConfig)).toBe(false);
    expect(isUiComponentFile('src/app/dashboard/_components/MetricCard.tsx', pathsConfig)).toBe(true);
    expect(isUiComponentFile('server/views/render_ticket.py', pathsConfig)).toBe(true);
    expect(isUiComponentFile('server/api/billing.py', pathsConfig)).toBe(false);
  });

  it('==> Should skip browser execution (exitCode 0) when only non-UI files changed, and scope audits to changed components when UI files changed', async () => {
    const parsed = parseCliArgs(['check', '--changed', '--base=main', '--json']);
    expect(parsed.command === 'check' && parsed.changed).toBe(true);
    expect(parsed.command === 'check' && parsed.baseRef).toBe('main');

    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-git-diff-e2e-'));
    try {
      execFileSync('git', ['init', '-b', 'main'], { cwd: tempDir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir, stdio: 'ignore' });

      mkdirSync(join(tempDir, 'src', 'components'), { recursive: true });
      writeFileSync(
        join(tempDir, 'src', 'components', 'ag-legacy-banner.ts'),
        `customElements.define('ag-legacy-banner', class extends HTMLElement {});\n`,
        'utf8'
      );
      writeFileSync(
        join(tempDir, 'index.html'),
        `<!DOCTYPE html>
        <html>
          <body>
            <ag-legacy-banner style="background:#ffffff;color:#e2e8f0;">Untouched low-contrast legacy banner</ag-legacy-banner>
            <ag-new-badge style="background:#0f172a;color:#ffffff;">Passing new badge</ag-new-badge>
          </body>
        </html>`,
        'utf8'
      );
      writeFileSync(join(tempDir, 'README.md'), '# Initial\n', 'utf8');
      execFileSync('git', ['add', '.'], { cwd: tempDir, stdio: 'ignore' });
      execFileSync('git', ['commit', '-m', 'chore: initial'], { cwd: tempDir, stdio: 'ignore' });

      // 1. Modify ONLY README.md -> executeCheckCommand exits 0 immediately with 0 viewports audited
      writeFileSync(join(tempDir, 'README.md'), '# Updated docs only\n', 'utf8');
      const docsOnlyReport = await executeCheckCommand({
        target: './index.html',
        cwd: tempDir,
        changed: true,
        baseRef: 'main',
        headless: true,
        silentStdout: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      });
      expect(docsOnlyReport.exitCode).toBe(0);
      expect(docsOnlyReport.summary.totalViewportsAudited).toBe(0);

      // 2. Add `ag-new-badge.ts` -> scopes audit strictly to `ag-new-badge` (ignores untouched `ag-legacy-banner`)
      writeFileSync(
        join(tempDir, 'src', 'components', 'ag-new-badge.ts'),
        `customElements.define('ag-new-badge', class extends HTMLElement {});\n`,
        'utf8'
      );
      const resolution = resolveChangedComponentSelectors(tempDir, 'main');
      expect(resolution.inferredSelectors).toEqual(['ag-new-badge']);

      const scopedReport = await executeCheckCommand({
        target: './index.html',
        cwd: tempDir,
        changed: true,
        baseRef: 'main',
        only: 'contrast',
        viewportsOverride: [{ name: 'desktop', width: 1280, height: 800 }],
        headless: true,
        silentStdout: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      });
      expect(scopedReport.exitCode).toBe(0);
      expect(scopedReport.results.at(0)?.scopedSelectors).toEqual(['ag-new-badge']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
