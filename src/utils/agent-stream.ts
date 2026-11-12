/**
 * src/utils/agent-stream.ts
 * Agentic JSON Tool Stream Output Generator.
 * Single Responsibility: Translates heterogeneous violation structures from all 4
 * core audit engines (`tokens`, `contrast`, `stress`, `cls`) into a flat, uniform
 * `IAgenticViolation` stream with deterministic `remediationAdvice` for AI agents.
 */

import type { ICheckExecutionReport, IViewportAuditReport } from '../commands/check.js';

/**
 * Unified, flat violation contract consumed by AI coding agents (Claude Code, Cursor, Codex).
 */
export interface IAgenticViolation {
  /** Which of the 4 core engines caught the defect. */
  engine: 'tokens' | 'contrast' | 'stress' | 'cls';
  /** Machine-readable defect category (e.g., 'token_drift', 'contrast_drop', 'container_overflow', 'cls_breach'). */
  violationType: string;
  /** Target URL where the violation occurred. */
  url: string;
  /** Viewport profile label and dimensions (e.g., 'mobile (375x812)'). */
  viewport: string;
  /** CSS or Shadow-DOM-piercing selector path (`host >> shadow-root >> inner`). */
  selector: string;
  /** True when the offending node lives inside an open ShadowRoot. */
  inShadowDom: boolean;
  /** Human- and machine-readable measurement showing how far the value drifted from budget. */
  measuredDelta: string;
  /** Actionable, deterministic fix instruction so the LLM can patch the UI immediately. */
  remediationAdvice: string;
}

/**
 * Top-level JSON envelope written to `stdout` when `uirig check --json` is invoked.
 */
export interface IAgenticJsonStreamPayload {
  tool: 'uirig';
  exitCode: 0 | 1 | 2;
  passed: boolean;
  timestamp: string;
  summary: ICheckExecutionReport['summary'];
  violations: IAgenticViolation[];
}

/**
 * Normalizes a single viewport audit report across all 4 engines (`tokens`, `contrast`,
 * `stress`, `cls`) into a flat array of `IAgenticViolation` items with deterministic
 * `remediationAdvice`.
 */
export function normalizeViewportViolations(
  viewportReport: IViewportAuditReport
): IAgenticViolation[] {
  const normalized: IAgenticViolation[] = [];
  const viewportLabel = `${viewportReport.viewport.name} (${viewportReport.viewport.width}x${viewportReport.viewport.height})`;

  // 1. Normalize Design Token Drift (`tokens`)
  for (const tokenViolation of viewportReport.tokenViolations) {
    normalized.push({
      engine: 'tokens',
      violationType: 'token_drift',
      url: viewportReport.url,
      viewport: viewportLabel,
      selector: tokenViolation.selector,
      inShadowDom: tokenViolation.inShadowDom,
      measuredDelta: `${tokenViolation.property}: ${tokenViolation.actualValue}`,
      remediationAdvice: `Replace hardcoded CSS property '${tokenViolation.property}' (${tokenViolation.actualValue}) on '${tokenViolation.selector}' with an approved design token from uirig.config.json tokensPath.`,
    });
  }

  // 2. Normalize Rendered Luminance Contrast Drops (`contrast`)
  for (const contrastViolation of viewportReport.contrastViolations) {
    normalized.push({
      engine: 'contrast',
      violationType: 'contrast_drop',
      url: viewportReport.url,
      viewport: viewportLabel,
      selector: contrastViolation.selector,
      inShadowDom: contrastViolation.inShadowDom,
      measuredDelta: `contrast ${contrastViolation.contrastRatio.toFixed(2)}:1 (required >= 4.50:1)`,
      remediationAdvice: `Adjust foreground (${contrastViolation.foregroundRgb}) or background (${contrastViolation.backgroundRgb}) on '${contrastViolation.selector}' so computed WCAG contrast reaches at least 4.50:1.`,
    });
  }
  // 3. Normalize Geometric Stress Breaches (`stress`)
  for (const stressViolation of viewportReport.stressViolations) {
    let remediationAdvice = '';

    if (stressViolation.violationType === 'container_overflow') {
      const parentTarget = stressViolation.relatedSelector ?? 'its parent container';
      remediationAdvice = `Allow text wrapping, remove 'white-space: nowrap', or widen '${parentTarget}' so '${stressViolation.selector}' does not overflow by ${stressViolation.measuredLeakPixels}px under +30% text expansion.`;
    } else if (stressViolation.violationType === 'horizontal_scrollbar') {
      remediationAdvice = `Eliminate horizontal viewport overflow (${stressViolation.measuredLeakPixels}px bleed) by constraining rigid widths or applying 'max-width: 100%' / responsive flex/grid wrapping.`;
    } else {
      const neighborTarget = stressViolation.relatedSelector ?? 'adjacent interactive element';
      remediationAdvice = `Increase gap/margin between '${stressViolation.selector}' and '${neighborTarget}' by at least ${stressViolation.measuredLeakPixels}px to meet the minimum touch-target spacing budget.`;
    }

    normalized.push({
      engine: 'stress',
      violationType: stressViolation.violationType,
      url: viewportReport.url,
      viewport: viewportLabel,
      selector: stressViolation.selector,
      inShadowDom: stressViolation.inShadowDom,
      measuredDelta: `+${stressViolation.measuredLeakPixels}px`,
      remediationAdvice,
    });
  }

  // 4. Normalize Cumulative Layout Shift Budget Breaches (`cls`)
  const clsViolation = viewportReport.clsEvaluation.violation;
  if (clsViolation !== null) {
    const selectorsList =
      clsViolation.offendingSelectors.length > 0
        ? clsViolation.offendingSelectors.join(', ')
        : 'document';
    const primarySelector = clsViolation.offendingSelectors.at(0) ?? 'document';

    normalized.push({
      engine: 'cls',
      violationType: 'cls_breach',
      url: viewportReport.url,
      viewport: viewportLabel,
      selector: primarySelector,
      inShadowDom: primarySelector.includes('>> shadow-root >>'),
      measuredDelta: `CLS ${clsViolation.measuredClsScore.toFixed(3)} (max ${clsViolation.clsMaxLimit.toFixed(3)})`,
      remediationAdvice: `Reserve explicit width/height or min-height dimensions for shifting elements (${selectorsList}) so session-window CLS (${clsViolation.measuredClsScore.toFixed(3)}) stays at or below ${clsViolation.clsMaxLimit.toFixed(3)}.`,
    });
  }

  return normalized;
}

/**
 * Builds the complete machine-readable JSON string emitted to `stdout` when
 * `uirig check --json` is executed. Contains zero ANSI codes or prose wrappers.
 *
 * @param report - Full execution report returned by `executeCheckCommand()`.
 * @returns Deterministic, pretty-printed JSON string ready for `process.stdout.write()`.
 */
export function formatAgenticJsonStream(report: ICheckExecutionReport): string {
  const violations: IAgenticViolation[] = [];

  for (const viewportResult of report.results) {
    const viewportViolations = normalizeViewportViolations(viewportResult);
    violations.push(...viewportViolations);
  }

  const payload: IAgenticJsonStreamPayload = {
    tool: 'uirig',
    exitCode: report.exitCode,
    passed: report.exitCode === 0,
    timestamp: report.timestamp,
    summary: report.summary,
    violations,
  };

  return JSON.stringify(payload, null, 2);
}
