/**
 * src/utils/console-report.ts
 * Human-readable terminal audit report formatter for `uirig`.
 * Ports and generalizes the playground's structured multi-engine check report
 * into core CLI runs so developers can inspect exact failing selectors, Shadow DOM
 * hosts, measured deltas, and suggested tokens directly in the terminal.
 */

import type { ICheckExecutionReport, IViewportAuditReport } from '../commands/check.js';
import { paint } from './formatter.js';

export interface IConsoleReportOptions {
  /** When true, prints every individual failing selector beneath each engine section. */
  verbose?: boolean;
}

function formatCountBadge(count: number): string {
  return count > 0 ? paint(`${count} FAIL`, 'bold', 'red') : paint('0 PASS', 'bold', 'green');
}

/**
 * Formats a single `(url, viewport)` audit report into a color-coded terminal breakdown
 * covering all core verification engines (`tokens`, `contrast`, `dark-mode`, `stress`,
 * `cls`, `dom`, and `runtime`).
 */
export function formatViewportConsoleSection(
  vpReport: IViewportAuditReport,
  verbose: boolean
): string[] {
  const darkViolations = vpReport.darkModeViolations ?? [];
  const domViolations = vpReport.domViolations ?? [];
  const runtimeErrors = vpReport.runtimeErrors ?? [];

  const viewportHeader = paint(
    `Target: ${vpReport.url} @ ${vpReport.viewport.name} (${vpReport.viewport.width}x${vpReport.viewport.height})`,
    'bold',
    'white'
  );

  const lines: string[] = [viewportHeader];

  // 1. Design Tokens (`tokens`)
  lines.push(
    `${paint('1. [tokens]', 'bold', 'magenta')}    Design Token Violations : ${formatCountBadge(
      vpReport.tokenViolations.length
    )}`
  );
  if (verbose) {
    for (const v of vpReport.tokenViolations) {
      const shadowTag = v.inShadowDom ? paint(' [ShadowDOM]', 'magenta') : '';
      lines.push(
        `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
          v.property,
          'cyan'
        )}: ${paint(v.actualValue, 'bold', 'red')})${shadowTag}`
      );
    }
  }

  // 2. Rendered Luminance Contrast (`contrast`)
  lines.push(
    `${paint('2. [contrast]', 'bold', 'cyan')}  Contrast Violations     : ${formatCountBadge(
      vpReport.contrastViolations.length
    )}`
  );
  if (verbose) {
    for (const v of vpReport.contrastViolations) {
      const tokenHint = v.suggestedToken
        ? paint(` -> try ${v.suggestedToken}`, 'green')
        : '';
      lines.push(
        `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
          `${v.contrastRatio.toFixed(2)}:1 < 4.5:1`,
          'bold',
          'red'
        )} | ${paint(`${v.foregroundRgb} on ${v.backgroundRgb}`, 'white')})${tokenHint}`
      );
    }
  }

  // 3. Dark-Mode Parity (`dark-mode`)
  lines.push(
    `${paint('3. [dark-mode]', 'bold', 'cyan')} Dark-Mode Violations    : ${formatCountBadge(
      darkViolations.length
    )}`
  );
  if (verbose) {
    for (const v of darkViolations) {
      const detail =
        v.violationType === 'stranded_light_surface'
          ? `luminance ${v.relativeLuminance?.toFixed(2) ?? 'high'} (${v.backgroundRgb})`
          : `${v.contrastRatio?.toFixed(2) ?? '0.00'}:1 < 4.5:1 (${v.foregroundRgb ?? 'text'} on ${v.backgroundRgb})`;
      lines.push(
        `   ${paint('•', 'red')} [${paint(v.violationType, 'cyan')}] ${paint(
          v.selector,
          'yellow'
        )} (${paint(detail, 'bold', 'red')})`
      );
    }
  }

  // 4. Geometric Stress (`stress`)
  lines.push(
    `${paint('4. [stress]', 'bold', 'yellow')}    Geometric Stress Hits   : ${formatCountBadge(
      vpReport.stressViolations.length
    )}`
  );
  if (verbose) {
    for (const v of vpReport.stressViolations) {
      const related = v.relatedSelector ? ` -> ${paint(v.relatedSelector, 'yellow')}` : '';
      lines.push(
        `   ${paint('•', 'red')} [${paint(v.violationType, 'cyan')}] ${paint(
          v.selector,
          'yellow'
        )}${related} (${paint(`+${v.measuredLeakPixels}`, 'bold', 'red')})`
      );
    }
  }

  // 5. Cumulative Layout Shift (`cls`)
  const clsFailed = vpReport.clsEvaluation.violation !== null;
  lines.push(
    `${paint('5. [cls]', 'bold', 'blue')}       Max Session CLS Score   : ${paint(
      String(vpReport.clsEvaluation.maxSessionCls),
      'bold',
      clsFailed ? 'red' : 'green'
    )} -> ${clsFailed ? paint('FAIL (Shift Detected)', 'bold', 'red') : paint('PASS', 'bold', 'green')}`
  );
  if (verbose && vpReport.clsEvaluation.violation) {
    const offending = vpReport.clsEvaluation.violation.offendingSelectors.join(', ') || 'document';
    lines.push(
      `   ${paint('•', 'red')} Shifting elements: ${paint(offending, 'yellow')} (limit: ${
        vpReport.clsEvaluation.violation.clsMaxLimit
      })`
    );
  }

  // 6. DOM, ARIA, Media & Security Hygiene (`dom`)
  lines.push(
    `${paint('6. [dom]', 'bold', 'red')}       DOM & A11y Violations   : ${formatCountBadge(
      domViolations.length
    )}`
  );
  if (verbose) {
    for (const v of domViolations) {
      lines.push(
        `   ${paint('•', 'red')} [${paint(v.rule, 'cyan')}] ${paint(
          v.selector,
          'yellow'
        )} (${paint(v.detail, 'white')})`
      );
    }
  }

  // 7. Uncaught Runtime JS Errors (`runtime`)
  if (runtimeErrors.length > 0 || verbose) {
    lines.push(
      `${paint('7. [runtime]', 'bold', 'red')}   Runtime JS Errors       : ${formatCountBadge(
        runtimeErrors.length
      )}`
    );
    if (verbose) {
      for (const err of runtimeErrors) {
        lines.push(
          `   ${paint('•', 'red')} [${paint(err.source, 'cyan')}] ${paint(
            err.message,
            'bold',
            'red'
          )}`
        );
      }
    }
  }

  return lines;
}

/**
 * Formats the complete `ICheckExecutionReport` into a scannable terminal summary table.
 * When `options.verbose` is true, prints every individual failing selector path;
 * otherwise prints per-engine pass/fail counts plus a hint to pass `--verbose`.
 */
export function formatConsoleAuditReport(
  report: ICheckExecutionReport,
  options: IConsoleReportOptions = {}
): string {
  const verbose = options.verbose ?? false;
  const divider = paint(
    '====================================================================',
    'cyan'
  );
  const title = paint('  uirig Live Multi-Engine Check Report', 'bold', 'cyan');

  const lines: string[] = ['', divider, title, divider];

  for (let i = 0; i < report.results.length; i++) {
    const vpReport = report.results[i];
    if (!vpReport) {
      continue;
    }
    if (i > 0) {
      lines.push(paint('--------------------------------------------------------------------', 'dim'));
    }
    lines.push(...formatViewportConsoleSection(vpReport, verbose));
  }

  const totalViolations =
    report.summary.totalTokenViolations +
    report.summary.totalContrastViolations +
    (report.summary.totalDarkModeViolations ?? 0) +
    report.summary.totalStressViolations +
    report.summary.totalClsViolations +
    (report.summary.totalDomViolations ?? 0) +
    (report.summary.totalRuntimeErrors ?? 0);

  lines.push(divider);

  if (!verbose && totalViolations > 0) {
    lines.push(
      paint(
        `Tip: ${totalViolations} violation(s) detected. Re-run with --verbose to list individual selector locations.`,
        'dim'
      )
    );
  }

  lines.push('');
  return lines.join('\n');
}
