/**
 * src/utils/fs.ts
 * Atomic framework-blind filesystem primitives and Markdown PR comment reporter.
 * Synthesizes `ICheckExecutionReport` payloads into `.uirig/github_pr_comment.md`.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import type { ICheckExecutionReport } from '../commands/check.js';
import { formatTelemetryLog, paint } from './formatter.js';

/**
 * Default relative path where `uirig check` writes the standalone GitHub PR comment artifact.
 */
export const DEFAULT_PR_COMMENT_PATH = '.uirig/github_pr_comment.md';

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

/**
 * Escapes pipe characters (`|`) and newlines so dynamic CSS selectors or values
 * never corrupt GitHub Flavored Markdown table cells.
 */
function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * Synthesizes an `ICheckExecutionReport` into a clean, self-contained GitHub Flavored
 * Markdown report ready to post as a Pull Request comment.
 *
 * @param report - Completed execution report from `executeCheckCommand()`.
 * @returns Formatted Markdown string.
 */
export function formatGithubPrCommentMarkdown(report: ICheckExecutionReport): string {
  const passed = report.exitCode === 0;
  const statusBanner = passed
    ? '✅ **PASSED** — All design tokens, contrast ratios, geometric stress bounds, and CLS budgets passed.'
    : `❌ **FAILED (POSIX Exit Code ${report.exitCode})** — UI verification violations detected across ${report.summary.totalViewportsAudited} viewport(s).`;

  const lines: string[] = [
    '## 🛡️ `uirig` UI Verification Gate Report',
    '',
    statusBanner,
    '',
    '### 📊 Audit Summary',
    '',
    '| Verification Engine | Violations | Status |',
    '| :--- | :---: | :---: |',
    `| **1. Design Tokens** (\`tokens\`) | ${report.summary.totalTokenViolations} | ${
      report.summary.totalTokenViolations === 0 ? '✅ Pass' : '❌ Fail'
    } |`,
    `| **2. WCAG 2.1 Contrast** (\`contrast\`) | ${report.summary.totalContrastViolations} | ${
      report.summary.totalContrastViolations === 0 ? '✅ Pass' : '❌ Fail'
    } |`,
    `| **3. Geometric Stress** (\`stress\`) | ${report.summary.totalStressViolations} | ${
      report.summary.totalStressViolations === 0 ? '✅ Pass' : '❌ Fail'
    } |`,
    `| **4. Layout Shift** (\`cls\`) | ${report.summary.totalClsViolations} | ${
      report.summary.totalClsViolations === 0 ? '✅ Pass' : '❌ Fail'
    } |`,
    '',
  ];

  // Append per-viewport violation breakdowns only for viewports that recorded issues
  const failingViewports = report.results.filter(
    (r) =>
      r.tokenViolations.length > 0 ||
      r.contrastViolations.length > 0 ||
      r.stressViolations.length > 0 ||
      r.clsEvaluation.violation !== null
  );

  if (failingViewports.length > 0) {
    lines.push('### 🔍 Violation Breakdown by Viewport', '');

    for (const vpReport of failingViewports) {
      lines.push(
        `#### \`${escapeMarkdownCell(vpReport.url)}\` — **${escapeMarkdownCell(
          vpReport.viewport.name
        )}** (${vpReport.viewport.width}x${vpReport.viewport.height})`,
        ''
      );

      if (vpReport.tokenViolations.length > 0) {
        lines.push(
          '**Design Token Drift (`tokens`):**',
          '',
          '| Selector | Property | Computed Value | Shadow DOM |',
          '| :--- | :--- | :--- | :---: |'
        );
        for (const v of vpReport.tokenViolations) {
          lines.push(
            `| \`${escapeMarkdownCell(v.selector)}\` | \`${escapeMarkdownCell(
              v.property
            )}\` | \`${escapeMarkdownCell(v.actualValue)}\` | ${v.inShadowDom ? 'Yes' : 'No'} |`
          );
        }
        lines.push('');
      }

      if (vpReport.contrastViolations.length > 0) {
        lines.push(
          '**WCAG 2.1 Contrast Failures (`contrast`):**',
          '',
          '| Selector | Ratio | Foreground | Background | Shadow DOM |',
          '| :--- | :---: | :--- | :--- | :---: |'
        );
        for (const v of vpReport.contrastViolations) {
          lines.push(
            `| \`${escapeMarkdownCell(v.selector)}\` | **${v.contrastRatio}:1** (< 4.5:1) | \`${escapeMarkdownCell(
              v.foregroundRgb
            )}\` | \`${escapeMarkdownCell(v.backgroundRgb)}\` | ${v.inShadowDom ? 'Yes' : 'No'} |`
          );
        }
        lines.push('');
      }

      if (vpReport.stressViolations.length > 0) {
        lines.push(
          '**Geometric Overflow & Collision Hits (`stress`):**',
          '',
          '| Type | Offending Selector | Related Container / Target | Leak / Deficit |',
          '| :--- | :--- | :--- | :---: |'
        );
        for (const v of vpReport.stressViolations) {
          const relatedCell = v.relatedSelector
            ? `\`${escapeMarkdownCell(v.relatedSelector)}\``
            : '—';
          lines.push(
            `| \`${escapeMarkdownCell(v.violationType)}\` | \`${escapeMarkdownCell(
              v.selector
            )}\` | ${relatedCell} | **+${v.measuredLeakPixels}px** |`
          );
        }
        lines.push('');
      }

      if (vpReport.clsEvaluation.violation !== null) {
        const clsV = vpReport.clsEvaluation.violation;
        const selectorsText =
          clsV.offendingSelectors.length > 0
            ? clsV.offendingSelectors.map((s) => `\`${escapeMarkdownCell(s)}\``).join(', ')
            : '*(unattributed shift)*';
        lines.push(
          '**Cumulative Layout Shift Breach (`cls`):**',
          '',
          `- **Measured Session CLS:** \`${clsV.measuredClsScore}\` (Budget limit: \`${clsV.clsMaxLimit}\`)`,
          `- **Shifts in Worst Window:** ${clsV.shiftCountInWorstWindow}`,
          `- **Shifted Selectors:** ${selectorsText}`,
          ''
        );
      }
    }
  }

  lines.push(
    '---',
    `*Generated by \`uirig\` at \`${report.timestamp}\` | Exit Code: \`${report.exitCode}\`*`
  );

  return `${lines.join('\n')}\n`;
}

/**
 * Synthesizes an `ICheckExecutionReport` into Markdown and atomically writes it
 * to `.uirig/github_pr_comment.md` (or a custom `outputPath`).
 *
 * @param report - Completed execution report from `executeCheckCommand()`.
 * @param outputPath - Target file path (defaults to `.uirig/github_pr_comment.md` in `process.cwd()`).
 * @returns The resolved absolute file path written to disk.
 */
export function writeGithubPrCommentReport(
  report: ICheckExecutionReport,
  outputPath: string = resolve(process.cwd(), DEFAULT_PR_COMMENT_PATH)
): string {
  const markdown = formatGithubPrCommentMarkdown(report);
  atomicWriteFile(outputPath, markdown);
  console.log(
    formatTelemetryLog(
      'fs:reporter',
      `Wrote Markdown PR comment report to ${paint(outputPath, 'cyan')}`
    )
  );
  return outputPath;
}
