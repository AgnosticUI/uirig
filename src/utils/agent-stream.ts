/**
 * src/utils/agent-stream.ts
 * Agentic JSON Tool Stream Output Generator.
 * Single Responsibility: Translates heterogeneous violation structures from all
 * core audit engines (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom`, `runtime`)
 * into a flat, uniform `IAgenticViolation` stream with Shadow host attribution,
 * pattern deduplication (`occurrenceCount`), and deterministic `remediationAdvice` for AI agents.
 */

import type { ICheckExecutionReport, IViewportAuditReport } from '../commands/check.js';
import type { UirigEngineName } from '../interfaces/locator.js';
import { extractHostComponentFromSelector } from './dom-walker.js';

/**
 * Unified, flat violation contract consumed by AI coding agents (Claude Code, Cursor, Codex).
 */
export interface IAgenticViolation {
  /** Which core engine caught the defect. */
  engine: UirigEngineName;
  /** Machine-readable defect category (e.g., 'token_drift', 'contrast_drop', 'container_overflow', 'cls_breach'). */
  violationType: string;
  /** Target URL where the violation occurred. */
  url: string;
  /** Viewport profile label and dimensions (e.g., 'mobile (375x812)'). */
  viewport: string;
  /** Enclosing Web Component custom element tag when inside an open ShadowRoot (e.g., 'ag-button'). */
  hostComponent: string | null;
  /** CSS or Shadow-DOM-piercing selector path (`host >> shadow-root >> inner`). */
  selector: string;
  /** True when the offending node lives inside an open ShadowRoot. */
  inShadowDom: boolean;
  /** Number of matching elements collapsed into this pattern violation (1 when unique). */
  occurrenceCount: number;
  /** Sample selector paths when multiple repeating elements share the exact same defect. */
  sampleSelectors?: string[];
  /** Human- and machine-readable measurement showing how far the value drifted from budget. */
  measuredDelta: string;
  /** Nearest passing design token when available. */
  suggestedToken?: string;
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
 * Normalizes a single viewport audit report across all engines (`tokens`, `contrast`,
 * `dark-mode`, `stress`, `cls`, `dom`, `runtime`) into a flat array of `IAgenticViolation`
 * items with Shadow host attribution and deterministic `remediationAdvice`.
 */
export function normalizeViewportViolations(
  viewportReport: IViewportAuditReport
): IAgenticViolation[] {
  const normalized: IAgenticViolation[] = [];
  const viewportLabel = `${viewportReport.viewport.name} (${viewportReport.viewport.width}x${viewportReport.viewport.height})`;

  // 1. Normalize Design Token Drift (`tokens`)
  for (const tokenViolation of viewportReport.tokenViolations) {
    const hostComponent =
      tokenViolation.hostComponent !== undefined
        ? tokenViolation.hostComponent
        : extractHostComponentFromSelector(tokenViolation.selector);

    normalized.push({
      engine: 'tokens',
      violationType: 'token_drift',
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent,
      selector: tokenViolation.selector,
      inShadowDom: tokenViolation.inShadowDom,
      occurrenceCount: 1,
      measuredDelta: `${tokenViolation.property}: ${tokenViolation.actualValue}`,
      remediationAdvice: `Replace hardcoded CSS property '${tokenViolation.property}' (${tokenViolation.actualValue}) on '${tokenViolation.selector}' with an approved design token from uirig.config.json tokensPath.`,
    });
  }

  // 2. Normalize Rendered Luminance Contrast Drops (`contrast`)
  for (const contrastViolation of viewportReport.contrastViolations) {
    const hostComponent =
      contrastViolation.hostComponent !== undefined
        ? contrastViolation.hostComponent
        : extractHostComponentFromSelector(contrastViolation.selector);
    const tokenSuffix = contrastViolation.suggestedToken
      ? ` Consider using approved token '${contrastViolation.suggestedToken}'.`
      : '';

    normalized.push({
      engine: 'contrast',
      violationType: 'contrast_drop',
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent,
      selector: contrastViolation.selector,
      inShadowDom: contrastViolation.inShadowDom,
      occurrenceCount: 1,
      measuredDelta: `contrast ${contrastViolation.contrastRatio.toFixed(2)}:1 (required >= 4.50:1)`,
      ...(contrastViolation.suggestedToken
        ? { suggestedToken: contrastViolation.suggestedToken }
        : {}),
      remediationAdvice: `Adjust foreground (${contrastViolation.foregroundRgb}) or background (${contrastViolation.backgroundRgb}) on '${contrastViolation.selector}' so computed WCAG contrast reaches at least 4.50:1.${tokenSuffix}`,
    });
  }

    // 3. Normalize Dark-Mode Theme Parity Violations (`dark-mode`)
  for (const darkViolation of viewportReport.darkModeViolations ?? []) {
    const hostComponent =
      darkViolation.hostComponent !== undefined
        ? darkViolation.hostComponent
        : extractHostComponentFromSelector(darkViolation.selector);

    const tokenSuffix = darkViolation.suggestedToken
      ? ` Consider applying '${darkViolation.suggestedToken}'.`
      : '';

    if (darkViolation.violationType === 'stranded_light_surface') {
      const lum = darkViolation.relativeLuminance?.toFixed(2) ?? 'high';
      normalized.push({
        engine: 'dark-mode',
        violationType: 'stranded_light_surface',
        url: viewportReport.url,
        viewport: viewportLabel,
        hostComponent,
        selector: darkViolation.selector,
        inShadowDom: darkViolation.inShadowDom,
        occurrenceCount: 1,
        measuredDelta: `luminance ${lum} in dark mode (${darkViolation.backgroundRgb})`,
        ...(darkViolation.suggestedToken ? { suggestedToken: darkViolation.suggestedToken } : {}),
        remediationAdvice: `Replace bright hardcoded background (${darkViolation.backgroundRgb}) on '${darkViolation.selector}' with a semantic dark-mode surface token.${tokenSuffix}`,
      });
    } else {
      const ratio = darkViolation.contrastRatio?.toFixed(2) ?? '0.00';
      normalized.push({
        engine: 'dark-mode',
        violationType: 'dark_mode_contrast_drop',
        url: viewportReport.url,
        viewport: viewportLabel,
        hostComponent,
        selector: darkViolation.selector,
        inShadowDom: darkViolation.inShadowDom,
        occurrenceCount: 1,
        measuredDelta: `dark-mode contrast ${ratio}:1 (required >= 4.50:1)`,
        ...(darkViolation.suggestedToken ? { suggestedToken: darkViolation.suggestedToken } : {}),
        remediationAdvice: `Adjust dark-mode foreground (${darkViolation.foregroundRgb ?? 'text'}) or background (${darkViolation.backgroundRgb}) on '${darkViolation.selector}' to reach >= 4.50:1.${tokenSuffix}`,
      });
    }
  }

  // 4. Normalize Geometric Stress Breaches (`stress`)
  for (const stressViolation of viewportReport.stressViolations) {
    let remediationAdvice = '';
    let measuredDelta = `+${stressViolation.measuredLeakPixels}px`;

    if (stressViolation.violationType === 'container_overflow') {
      const parentTarget = stressViolation.relatedSelector ?? 'its parent container';
      remediationAdvice = `Allow text wrapping, remove 'white-space: nowrap', or widen '${parentTarget}' so '${stressViolation.selector}' does not overflow by ${stressViolation.measuredLeakPixels}px under +30% text expansion.`;
    } else if (stressViolation.violationType === 'horizontal_scrollbar') {
      remediationAdvice = `Eliminate horizontal viewport overflow (${stressViolation.measuredLeakPixels}px bleed) by constraining rigid widths or applying 'max-width: 100%' / responsive flex/grid wrapping.`;
    } else if (stressViolation.violationType === 'undersized_touch_target') {
      remediationAdvice = `Increase width/height or padding of interactive control '${stressViolation.selector}' by ${stressViolation.measuredLeakPixels}px so it meets the minimum 24x24px WCAG 2.5.8 touch-target size.`;
    } else if (stressViolation.violationType === 'squished_avatar') {
      measuredDelta = `${stressViolation.measuredLeakPixels}% aspect-ratio distortion`;
      remediationAdvice = `Add 'flex-shrink: 0' and explicit width/height to avatar '${stressViolation.selector}' so sibling text expansion does not distort its aspect ratio (${stressViolation.measuredLeakPixels}% drift).`;
    } else if (stressViolation.violationType === 'stuck_invisible_element') {
      measuredDelta = 'opacity: 0 while occupying layout space';
      remediationAdvice = `Element '${stressViolation.selector}' has 'opacity: 0' while occupying layout bounds. Ensure scroll-reveal animations complete or apply 'display: none' / 'aria-hidden="true"' if intentionally hidden.`;
    } else {
      const neighborTarget = stressViolation.relatedSelector ?? 'adjacent interactive element';
      remediationAdvice = `Increase gap/margin between '${stressViolation.selector}' and '${neighborTarget}' by at least ${stressViolation.measuredLeakPixels}px to meet the minimum touch-target spacing budget.`;
    }

    const hostComponent =
      stressViolation.hostComponent !== undefined
        ? stressViolation.hostComponent
        : extractHostComponentFromSelector(stressViolation.selector);

    normalized.push({
      engine: 'stress',
      violationType: stressViolation.violationType,
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent,
      selector: stressViolation.selector,
      inShadowDom: stressViolation.inShadowDom,
      occurrenceCount: 1,
      measuredDelta,
      remediationAdvice,
    });
  }

  // 5. Normalize Cumulative Layout Shift Budget Breaches (`cls`)
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
      hostComponent: extractHostComponentFromSelector(primarySelector),
      selector: primarySelector,
      inShadowDom: primarySelector.includes('>> shadow-root >>'),
      occurrenceCount: 1,
      measuredDelta: `CLS ${clsViolation.measuredClsScore.toFixed(3)} (max ${clsViolation.clsMaxLimit.toFixed(3)})`,
      remediationAdvice: `Reserve explicit width/height or min-height dimensions for shifting elements (${selectorsList}) so session-window CLS (${clsViolation.measuredClsScore.toFixed(3)}) stays at or below ${clsViolation.clsMaxLimit.toFixed(3)}.`,
    });
  }

    // 6. Normalize DOM & Markup Integrity Violations (`dom`)
  for (const domViolation of viewportReport.domViolations ?? []) {
    const hostComponent =
      domViolation.hostComponent !== undefined
        ? domViolation.hostComponent
        : extractHostComponentFromSelector(domViolation.selector);

    normalized.push({
      engine: 'dom',
      violationType: domViolation.rule,
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent,
      selector: domViolation.selector,
      inShadowDom: domViolation.inShadowDom,
      occurrenceCount: 1,
      measuredDelta: domViolation.detail,
      remediationAdvice: `Fix '${domViolation.rule}' on '${domViolation.selector}': ${domViolation.detail}`,
    });
  }

  // 7. Normalize Uncaught Runtime JS & Console Errors (`runtime`)
  for (const runtimeErr of viewportReport.runtimeErrors ?? []) {
    normalized.push({
      engine: 'runtime',
      violationType: runtimeErr.source,
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent: null,
      selector: runtimeErr.location ?? 'window',
      inShadowDom: false,
      occurrenceCount: 1,
      measuredDelta: runtimeErr.message,
      remediationAdvice: `Resolve uncaught runtime error (${runtimeErr.source}): ${runtimeErr.message}`,
    });
  }

  return normalized;
}

/**
 * Normalizes a selector path by stripping `#id` suffixes so repeating list/card items
 * (e.g. `li#item-1 > span.muted` and `li#item-2 > span.muted`) group cleanly together.
 */
function buildPatternSignature(selector: string): string {
  return selector.replace(/#[A-Za-z0-9_-]+/g, '');
}

/**
 * Collapses repeating identical defects within the same `(engine, violationType, url, viewport, hostComponent, pattern, measuredDelta)`
 * bucket into a single entry with `occurrenceCount` and up to 5 `sampleSelectors` to prevent AI context bloat.
 */
export function deduplicateAgenticViolations(
  violations: IAgenticViolation[]
): IAgenticViolation[] {
  const grouped = new Map<string, IAgenticViolation>();

  for (const item of violations) {
    const pattern = buildPatternSignature(item.selector);
    const key = [
      item.engine,
      item.violationType,
      item.url,
      item.viewport,
      item.hostComponent ?? '',
      pattern,
      item.measuredDelta,
    ].join('::');

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...item, occurrenceCount: 1 });
    } else {
      existing.occurrenceCount += 1;
      const samples = existing.sampleSelectors ?? [existing.selector];
      if (!samples.includes(item.selector) && samples.length < 5) {
        samples.push(item.selector);
      }
      existing.sampleSelectors = samples;
    }
  }

  return Array.from(grouped.values());
}

/**
 * Builds the complete machine-readable JSON string emitted to `stdout` when
 * `uirig check --json` is executed. Contains zero ANSI codes or prose wrappers.
 *
 * @param report - Full execution report returned by `executeCheckCommand()`.
 * @returns Deterministic, pretty-printed JSON string ready for `process.stdout.write()`.
 */
export function formatAgenticJsonStream(report: ICheckExecutionReport): string {
  const rawViolations: IAgenticViolation[] = [];

  for (const viewportResult of report.results) {
    const viewportViolations = normalizeViewportViolations(viewportResult);
    rawViolations.push(...viewportViolations);
  }

  const violations = deduplicateAgenticViolations(rawViolations);

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
