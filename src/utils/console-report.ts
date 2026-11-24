/**
 * src/utils/console-report.ts
 * Human-readable terminal audit report formatter for `uirig`.
 * Ports and generalizes the playground's structured multi-engine check report
 * into core CLI runs so developers can inspect matched selector counts, exact failing
 * selectors, source-map `file:line` locations, Shadow DOM hosts, A2UI component IDs,
 * measured deltas, breakpoint sweep ranges (`failedWidths`), and suggested tokens
 * directly in the terminal.
 */

import type { ICheckExecutionReport, IViewportAuditReport } from '../commands/check.js';
import type { IA2uiAttribution, ISourceLocation } from '../interfaces/locator.js';
import { paint } from './formatter.js';

export interface IConsoleReportOptions {
  /** When true, prints every individual failing selector beneath each engine section. */
  verbose?: boolean;
}

function formatCountBadge(count: number): string {
  return count > 0 ? paint(`${count} FAIL`, 'bold', 'red') : paint('0 PASS', 'bold', 'green');
}

function formatViolationContext(options: {
  sourceLocation?: ISourceLocation | null;
  hostComponent?: string | null;
  a2ui?: IA2uiAttribution | null;
}): string {
  const parts: string[] = [];
  if (options.sourceLocation?.sourceFile && options.sourceLocation.lineNumber !== null) {
    parts.push(`${options.sourceLocation.sourceFile}:${options.sourceLocation.lineNumber}`);
  }
  if (options.hostComponent) {
    parts.push(`in <${options.hostComponent}>`);
  }
  if (options.a2ui) {
    const surface = options.a2ui.surfaceId ?? 'surface';
    const comp = options.a2ui.a2uiComponentId ?? options.a2ui.a2uiComponentType ?? 'component';
    parts.push(`a2ui: ${surface}/${comp}`);
  }
  return parts.length > 0 ? ` [${paint(parts.join(' | '), 'cyan')}]` : '';
}

/**
 * Formats a single `(url, viewport, theme)` audit report into a color-coded terminal breakdown
 * covering matched selector scope counts and all core verification engines
 * (`tokens`, `contrast`, `dark-mode`, `stress`, `sweep`, `cls`, `dom`, and `runtime`).
 */
export function formatViewportConsoleSection(
  vpReport: IViewportAuditReport,
  verbose: boolean
): string[] {
  const darkViolations = vpReport.darkModeViolations ?? [];
  const sweepViolations = vpReport.sweepViolations ?? [];
  const domViolations = vpReport.domViolations ?? [];
  const runtimeErrors = vpReport.runtimeErrors ?? [];
  const sourceMap = vpReport.sourceLocations ?? {};
  const a2uiMap = vpReport.a2uiAttributions ?? {};

  const themeTag = vpReport.theme ? ` [theme: ${vpReport.theme}]` : '';
  const viewportHeader = paint(
    `Target: ${vpReport.url} @ ${vpReport.viewport.name} (${vpReport.viewport.width}x${vpReport.viewport.height})${themeTag}`,
    'bold',
    'white'
  );

  const lines: string[] = [viewportHeader];

  // Display matched element count before engine summary when `--selectors` / `-s` was provided
  if (vpReport.matchedSelectorCount !== undefined) {
    const scopeLabel =
      vpReport.scopedSelectors && vpReport.scopedSelectors.length > 0
        ? ` (${vpReport.scopedSelectors.join(', ')})`
        : '';
    const countText =
      vpReport.matchedSelectorCount === 0
        ? paint('0 (Warning: no elements matched selector)', 'bold', 'yellow')
        : paint(String(vpReport.matchedSelectorCount), 'bold', 'cyan');
    lines.push(`Selectors matched on page${scopeLabel}: ${countText}`);
  }

  // 1. Design Tokens (`tokens`)
  lines.push(
    `${paint('1. [tokens]', 'bold', 'magenta')}    Design Token Violations : ${formatCountBadge(
      vpReport.tokenViolations.length
    )}`
  );
  if (verbose) {
    for (const v of vpReport.tokenViolations) {
      const shadowTag = v.inShadowDom ? paint(' [ShadowDOM]', 'magenta') : '';
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
      });
      lines.push(
        `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
          v.property,
          'cyan'
        )}: ${paint(v.actualValue, 'bold', 'red')})${shadowTag}${ctx}`
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
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
      });
      lines.push(
        `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
          `${v.contrastRatio.toFixed(2)}:1 < 4.5:1`,
          'bold',
          'red'
        )} | ${paint(`${v.foregroundRgb} on ${v.backgroundRgb}`, 'white')})${tokenHint}${ctx}`
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
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
      });
      lines.push(
        `   ${paint('•', 'red')} [${paint(v.violationType, 'cyan')}] ${paint(
          v.selector,
          'yellow'
        )} (${paint(detail, 'bold', 'red')})${ctx}`
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
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
      });
      lines.push(
        `   ${paint('•', 'red')} [${paint(v.violationType, 'cyan')}] ${paint(
          v.selector,
          'yellow'
        )}${related} (${paint(`+${v.measuredLeakPixels}`, 'bold', 'red')})${ctx}`
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
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
      });
      lines.push(
        `   ${paint('•', 'red')} [${paint(v.rule, 'cyan')}] ${paint(
          v.selector,
          'yellow'
        )} (${paint(v.detail, 'white')})${ctx}`
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

  // 8. Responsive Breakpoint Sweep (`sweep`)
  if (sweepViolations.length > 0 || verbose) {
    lines.push(
      `${paint('8. [sweep]', 'bold', 'yellow')}     Breakpoint Sweep Hits   : ${formatCountBadge(
        sweepViolations.length
      )}`
    );
    if (verbose) {
      for (const v of sweepViolations) {
        const related = v.relatedSelector ? ` -> ${paint(v.relatedSelector, 'yellow')}` : '';
        const ctx = formatViolationContext({
          sourceLocation: sourceMap[v.selector] ?? null,
          hostComponent: v.hostComponent,
          a2ui: a2uiMap[v.selector] ?? null,
        });
        lines.push(
          `   ${paint('•', 'red')} [${paint(v.violationType, 'cyan')}] ${paint(
            v.selector,
            'yellow'
          )}${related} (${paint(`failedWidths: ${v.failedWidths}`, 'bold', 'red')} | +${
            v.measuredLeakPixels
          }px)${ctx}`
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
    (report.summary.totalSweepViolations ?? 0) +
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
