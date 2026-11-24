/**
 * src/utils/agent-stream.ts
 * Agentic JSON Tool Stream Output Generator.
 * Single Responsibility: Translates heterogeneous violation structures from all
 * core audit engines (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom`, `runtime`)
 * into a flat, uniform `IAgenticViolation` stream with Shadow host attribution,
 * pattern deduplication (`occurrenceCount`), parent-container grouping (`--group-by-root`),
 * priority ranking, and optional `--top` / `--max-tokens` output limits for AI agents.
 */

import type { ICheckExecutionReport, IViewportAuditReport } from '../commands/check.js';
import type { IA2uiAttribution, UirigEngineName } from '../interfaces/locator.js';
import { extractHostComponentFromSelector } from './dom-walker.js';
import {
  applyViolationBudget,
  type IViolationBudgetOptions,
} from './violation-budget.js';
import { groupViolationsByRootCause } from './root-cause-grouper.js';
import { enrichA2uiAttributionWithAdvice } from './a2ui-attribution.js';
import { computeDeterministicAutoFix } from '../core/autofix.js';

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
  /** Out-of-band A2UI (Agent-to-UI) v1.0 component attribution when inside `<a2ui-surface>` (`null` otherwise). */
  a2ui?: IA2uiAttribution | null;
  /** Resolved original source file path from CSS (Cascading Style Sheets) / JS (JavaScript) source maps or dev attributes (`null` when unmapped). */
  sourceFile?: string | null;
  /** 1-based original line number in `sourceFile` (`null` when unmapped). */
  lineNumber?: number | null;
  /** 1-based original column number in `sourceFile` (`null` when unmapped). */
  columnNumber?: number | null;
  /** Deterministic single-line unified diff when `sourceFile` and `lineNumber` resolve to an unambiguous 1-to-1 fix (`null` otherwise). */
  unifiedDiff?: string | null;
  /** CSS or Shadow-DOM-piercing selector path (`host >> shadow-root >> inner`). */
  selector: string;
  /** True when the offending node lives inside an open ShadowRoot. */
  inShadowDom: boolean;
  /** Number of matching elements collapsed into this pattern violation (1 when unique). */
  occurrenceCount: number;
  /** Sample selector paths when multiple repeating elements share the exact same defect. */
  sampleSelectors?: Array<string>;
  /** Total child violations collapsed under this shared parent container when `--group-by-root` is enabled. */
  childCount?: number;
  /** Up to 3 representative child selectors that failed beneath this parent when `--group-by-root` is enabled. */
  sampleChildren?: Array<string>;
  /** Human- and machine-readable measurement showing how far the value drifted from budget. */
  measuredDelta: string;
  /** Nearest passing design token when available. */
  suggestedToken?: string;
  /** Actionable, deterministic fix instruction so the LLM (Large Language Model) can patch the UI immediately. */
  remediationAdvice: string;
  /** Collapsed contiguous failing viewport width range(s) when `--sweep` is active (e.g. `"760px-880px"`). */
  failedWidths?: string;
}

/**
 * Top-level JSON envelope written to `stdout` when `uirig check --json` is invoked.
 */
export interface IAgenticJsonStreamPayload {
  tool: 'uirig';
  exitCode: 0 | 1 | 2;
  passed: boolean;
  timestamp: string;
  /** Compact plain-text layout geometry emitted when `--spatial-brief` is enabled. */
  spatialBrief?: string;
  /** Total unique violations before `--top` or `--max-tokens` trimming (included when truncated). */
  totalViolations?: number;
  /** Number of lower-priority violations omitted due to `--top` or `--max-tokens` (included when truncated). */
  truncatedCount?: number;
  summary: ICheckExecutionReport['summary'];
  violations: Array<IAgenticViolation>;
}

/**
 * Normalizes a single viewport audit report across all engines (`tokens`, `contrast`,
 * `dark-mode`, `stress`, `cls`, `dom`, `runtime`) into a flat array of `IAgenticViolation`
 * items with Shadow host attribution and deterministic `remediationAdvice`.
 */
export function normalizeViewportViolations(
  viewportReport: IViewportAuditReport
): Array<IAgenticViolation> {
  const normalized = new Array<IAgenticViolation>();
  const baseViewportLabel =
    viewportReport.viewport.name +
    ' (' +
    viewportReport.viewport.width +
    'x' +
    viewportReport.viewport.height +
    ')';
  const viewportLabel = viewportReport.theme
    ? baseViewportLabel + ' [theme: ' + viewportReport.theme + ']'
    : baseViewportLabel;

  function resolveA2uiForViolation(params: {
    selector: string;
    engine: string;
    violationType: string;
    measuredDelta: string;
    suggestedToken?: string;
    fallbackAdvice: string;
  }): { a2ui: IA2uiAttribution | null; remediationAdvice: string } {
    const rawAttribution = viewportReport.a2uiAttributions?.[params.selector] ?? null;
    if (!rawAttribution) {
      return {
        a2ui: null,
        remediationAdvice: params.fallbackAdvice,
      };
    }
    const enriched = enrichA2uiAttributionWithAdvice({
      attribution: rawAttribution,
      engine: params.engine,
      violationType: params.violationType,
      measuredDelta: params.measuredDelta,
      suggestedToken: params.suggestedToken,
      fallbackAdvice: params.fallbackAdvice,
    });
    return {
      a2ui: enriched.attribution,
      remediationAdvice: enriched.remediationAdvice,
    };
  }

  // 1. Normalize Design Token Drift (`tokens`)
  for (const tokenViolation of viewportReport.tokenViolations) {
    const hostComponent =
      tokenViolation.hostComponent !== undefined
        ? tokenViolation.hostComponent
        : extractHostComponentFromSelector(tokenViolation.selector);
    const measuredDelta = tokenViolation.property + ': ' + tokenViolation.actualValue;
    const fallbackAdvice =
      "Replace hardcoded CSS property '" +
      tokenViolation.property +
      "' (" +
      tokenViolation.actualValue +
      ") on '" +
      tokenViolation.selector +
      "' with an approved design token from uirig.config.json tokensPath.";
    const { a2ui, remediationAdvice } = resolveA2uiForViolation({
      selector: tokenViolation.selector,
      engine: 'tokens',
      violationType: 'token_drift',
      measuredDelta,
      fallbackAdvice,
    });

    normalized.push({
      engine: 'tokens',
      violationType: 'token_drift',
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent,
      a2ui,
      selector: tokenViolation.selector,
      inShadowDom: tokenViolation.inShadowDom,
      occurrenceCount: 1,
      measuredDelta,
      remediationAdvice,
    });
  }

  // 2. Normalize Rendered Luminance Contrast Drops (`contrast`)
  for (const contrastViolation of viewportReport.contrastViolations) {
    const hostComponent =
      contrastViolation.hostComponent !== undefined
        ? contrastViolation.hostComponent
        : extractHostComponentFromSelector(contrastViolation.selector);
    const tokenSuffix = contrastViolation.suggestedToken
      ? " Consider using approved token '" + contrastViolation.suggestedToken + "'."
      : '';
    const measuredDelta =
      'contrast ' + contrastViolation.contrastRatio.toFixed(2) + ':1 (required >= 4.50:1)';
    const fallbackAdvice =
      'Adjust foreground (' +
      contrastViolation.foregroundRgb +
      ') or background (' +
      contrastViolation.backgroundRgb +
      ") on '" +
      contrastViolation.selector +
      "' so computed WCAG (Web Content Accessibility Guidelines) contrast reaches at least 4.50:1." +
      tokenSuffix;
    const { a2ui, remediationAdvice } = resolveA2uiForViolation({
      selector: contrastViolation.selector,
      engine: 'contrast',
      violationType: 'contrast_drop',
      measuredDelta,
      suggestedToken: contrastViolation.suggestedToken,
      fallbackAdvice,
    });

    normalized.push({
      engine: 'contrast',
      violationType: 'contrast_drop',
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent,
      a2ui,
      selector: contrastViolation.selector,
      inShadowDom: contrastViolation.inShadowDom,
      occurrenceCount: 1,
      measuredDelta,
      ...(contrastViolation.suggestedToken
        ? { suggestedToken: contrastViolation.suggestedToken }
        : {}),
      remediationAdvice,
    });
  }
  // 3. Normalize Dark-Mode Theme Parity Violations (`dark-mode`)
  for (const darkViolation of viewportReport.darkModeViolations ?? new Array()) {
    const hostComponent =
      darkViolation.hostComponent !== undefined
        ? darkViolation.hostComponent
        : extractHostComponentFromSelector(darkViolation.selector);
    const tokenSuffix = darkViolation.suggestedToken
      ? " Consider applying '" + darkViolation.suggestedToken + "'."
      : '';

    if (darkViolation.violationType === 'stranded_light_surface') {
      const lum = darkViolation.relativeLuminance?.toFixed(2) ?? 'high';
      const measuredDelta = 'luminance ' + lum + ' in dark mode (' + darkViolation.backgroundRgb + ')';
      const fallbackAdvice =
        'Replace bright hardcoded background (' +
        darkViolation.backgroundRgb +
        ") on '" +
        darkViolation.selector +
        "' with a semantic dark-mode surface token." +
        tokenSuffix;
      const { a2ui, remediationAdvice } = resolveA2uiForViolation({
        selector: darkViolation.selector,
        engine: 'dark-mode',
        violationType: 'stranded_light_surface',
        measuredDelta,
        suggestedToken: darkViolation.suggestedToken,
        fallbackAdvice,
      });

      normalized.push({
        engine: 'dark-mode',
        violationType: 'stranded_light_surface',
        url: viewportReport.url,
        viewport: viewportLabel,
        hostComponent,
        a2ui,
        selector: darkViolation.selector,
        inShadowDom: darkViolation.inShadowDom,
        occurrenceCount: 1,
        measuredDelta,
        ...(darkViolation.suggestedToken ? { suggestedToken: darkViolation.suggestedToken } : {}),
        remediationAdvice,
      });
    } else {
      const ratio = darkViolation.contrastRatio?.toFixed(2) ?? '0.00';
      const measuredDelta = 'dark-mode contrast ' + ratio + ':1 (required >= 4.50:1)';
      const fallbackAdvice =
        'Adjust dark-mode foreground (' +
        (darkViolation.foregroundRgb ?? 'text') +
        ') or background (' +
        darkViolation.backgroundRgb +
        ") on '" +
        darkViolation.selector +
        "' to reach >= 4.50:1." +
        tokenSuffix;
      const { a2ui, remediationAdvice } = resolveA2uiForViolation({
        selector: darkViolation.selector,
        engine: 'dark-mode',
        violationType: 'dark_mode_contrast_drop',
        measuredDelta,
        suggestedToken: darkViolation.suggestedToken,
        fallbackAdvice,
      });

      normalized.push({
        engine: 'dark-mode',
        violationType: 'dark_mode_contrast_drop',
        url: viewportReport.url,
        viewport: viewportLabel,
        hostComponent,
        a2ui,
        selector: darkViolation.selector,
        inShadowDom: darkViolation.inShadowDom,
        occurrenceCount: 1,
        measuredDelta,
        ...(darkViolation.suggestedToken ? { suggestedToken: darkViolation.suggestedToken } : {}),
        remediationAdvice,
      });
    }
  }

  // 4. Normalize Geometric Stress Breaches (`stress`)
  for (const stressViolation of viewportReport.stressViolations) {
    let fallbackAdvice = '';
    let measuredDelta = '+' + stressViolation.measuredLeakPixels + 'px';

    if (stressViolation.violationType === 'container_overflow') {
      const parentTarget = stressViolation.relatedSelector ?? 'its parent container';
      fallbackAdvice =
        "Allow text wrapping, remove 'white-space: nowrap', or widen '" +
        parentTarget +
        "' so '" +
        stressViolation.selector +
        "' does not overflow by " +
        stressViolation.measuredLeakPixels +
        'px under +30% text expansion.';
    } else if (stressViolation.violationType === 'horizontal_scrollbar') {
      fallbackAdvice =
        'Eliminate horizontal viewport overflow (' +
        stressViolation.measuredLeakPixels +
        "px bleed) by constraining rigid widths or applying 'max-width: 100%' / responsive flex/grid wrapping.";
    } else if (stressViolation.violationType === 'undersized_touch_target') {
      fallbackAdvice =
        "Increase width/height or padding of interactive control '" +
        stressViolation.selector +
        "' by " +
        stressViolation.measuredLeakPixels +
        'px so it meets the minimum 24x24px WCAG 2.5.8 touch-target size.';
    } else if (stressViolation.violationType === 'squished_avatar') {
      measuredDelta = stressViolation.measuredLeakPixels + '% aspect-ratio distortion';
      fallbackAdvice =
        "Add 'flex-shrink: 0' and explicit width/height to avatar '" +
        stressViolation.selector +
        "' so sibling text expansion does not distort its aspect ratio (" +
        stressViolation.measuredLeakPixels +
        '% drift).';
    } else if (stressViolation.violationType === 'stuck_invisible_element') {
      measuredDelta = 'opacity: 0 while occupying layout space';
      fallbackAdvice =
        "Element '" +
        stressViolation.selector +
        "' has 'opacity: 0' while occupying layout bounds. Ensure scroll-reveal animations complete or apply 'display: none' / 'aria-hidden=\"true\"' if intentionally hidden.";
    } else {
      const neighborTarget = stressViolation.relatedSelector ?? 'adjacent interactive element';
      fallbackAdvice =
        "Increase gap/margin between '" +
        stressViolation.selector +
        "' and '" +
        neighborTarget +
        "' by at least " +
        stressViolation.measuredLeakPixels +
        'px to meet the minimum touch-target spacing budget.';
    }

    const hostComponent =
      stressViolation.hostComponent !== undefined
        ? stressViolation.hostComponent
        : extractHostComponentFromSelector(stressViolation.selector);
    const { a2ui, remediationAdvice } = resolveA2uiForViolation({
      selector: stressViolation.selector,
      engine: 'stress',
      violationType: stressViolation.violationType,
      measuredDelta,
      fallbackAdvice,
    });

    normalized.push({
      engine: 'stress',
      violationType: stressViolation.violationType,
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent,
      a2ui,
      selector: stressViolation.selector,
      inShadowDom: stressViolation.inShadowDom,
      occurrenceCount: 1,
      measuredDelta,
      remediationAdvice,
    });
  }

  // 4b. Normalize Responsive Breakpoint Sweep Breaches (`sweep`)
  for (const sweepViolation of viewportReport.sweepViolations ?? new Array()) {
    const hostComponent =
      sweepViolation.hostComponent !== undefined
        ? sweepViolation.hostComponent
        : extractHostComponentFromSelector(sweepViolation.selector);
    const measuredDelta =
      '+' + sweepViolation.measuredLeakPixels + 'px across ' + sweepViolation.failedWidths;
    let fallbackAdvice = '';

    if (sweepViolation.violationType === 'container_overflow') {
      const parentTarget = sweepViolation.relatedSelector ?? 'its parent container';
      fallbackAdvice =
        "Constrain width or enable responsive wrapping inside '" +
        parentTarget +
        "' so '" +
        sweepViolation.selector +
        "' does not overflow by " +
        sweepViolation.measuredLeakPixels +
        'px across viewport widths ' +
        sweepViolation.failedWidths +
        '.';
    } else if (sweepViolation.violationType === 'horizontal_scrollbar') {
      fallbackAdvice =
        'Eliminate horizontal viewport overflow (' +
        sweepViolation.measuredLeakPixels +
        'px bleed) across viewport widths ' +
        sweepViolation.failedWidths +
        " by replacing rigid pixel widths with fluid 'max-width: 100%' or responsive layout rules.";
    } else {
      const neighborTarget = sweepViolation.relatedSelector ?? 'adjacent interactive element';
      fallbackAdvice =
        "Increase gap/margin or stack '" +
        sweepViolation.selector +
        "' and '" +
        neighborTarget +
        "' across viewport widths " +
        sweepViolation.failedWidths +
        ' so edge clearance stays >= 24px (deficit ' +
        sweepViolation.measuredLeakPixels +
        'px).';
    }

    const { a2ui, remediationAdvice } = resolveA2uiForViolation({
      selector: sweepViolation.selector,
      engine: 'sweep',
      violationType: sweepViolation.violationType,
      measuredDelta,
      fallbackAdvice,
    });

    normalized.push({
      engine: 'sweep',
      violationType: sweepViolation.violationType,
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent,
      a2ui,
      selector: sweepViolation.selector,
      inShadowDom: sweepViolation.inShadowDom,
      occurrenceCount: 1,
      failedWidths: sweepViolation.failedWidths,
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
    const measuredDelta =
      'CLS ' +
      clsViolation.measuredClsScore.toFixed(3) +
      ' (max ' +
      clsViolation.clsMaxLimit.toFixed(3) +
      ')';
    const fallbackAdvice =
      'Reserve explicit width/height or min-height dimensions for shifting elements (' +
      selectorsList +
      ') so session-window CLS (Cumulative Layout Shift) (' +
      clsViolation.measuredClsScore.toFixed(3) +
      ') stays at or below ' +
      clsViolation.clsMaxLimit.toFixed(3) +
      '.';
    const { a2ui, remediationAdvice } = resolveA2uiForViolation({
      selector: primarySelector,
      engine: 'cls',
      violationType: 'cls_breach',
      measuredDelta,
      fallbackAdvice,
    });

    normalized.push({
      engine: 'cls',
      violationType: 'cls_breach',
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent: extractHostComponentFromSelector(primarySelector),
      a2ui,
      selector: primarySelector,
      inShadowDom: primarySelector.includes('>> shadow-root >>'),
      occurrenceCount: 1,
      measuredDelta,
      remediationAdvice,
    });
  }

    // 6. Normalize DOM & Markup Integrity Violations (`dom`)
  for (const domViolation of viewportReport.domViolations ?? new Array()) {
    const hostComponent =
      domViolation.hostComponent !== undefined
        ? domViolation.hostComponent
        : extractHostComponentFromSelector(domViolation.selector);

    let fallbackAdvice: string;
    if (domViolation.rule === 'orphaned_slot_content') {
      fallbackAdvice =
        "Update or remove the 'slot' attribute on '" +
        domViolation.selector +
        "' to match one of the custom element's valid slots, or remove the orphaned light-DOM child if no <slot> exists. (" +
        domViolation.detail +
        ')';
    } else if (domViolation.rule === 'ax_empty_name') {
      fallbackAdvice =
        "Provide a non-empty computed accessible name on '" +
        domViolation.selector +
        "' via visible text content, aria-label, or a valid same-root aria-labelledby reference so screen readers announce the interactive control. (" +
        domViolation.detail +
        ')';
    } else if (domViolation.rule === 'ax_hidden_focus') {
      fallbackAdvice =
        "Remove the focusable control '" +
        domViolation.selector +
        "' from the tab order (tabindex=\"-1\" or inert) or remove aria-hidden=\"true\" from its ancestor so keyboard focus cannot enter an invisible subtree. (" +
        domViolation.detail +
        ')';
    } else {
      fallbackAdvice =
        "Fix '" + domViolation.rule + "' on '" + domViolation.selector + "': " + domViolation.detail;
    }

    const { a2ui, remediationAdvice } = resolveA2uiForViolation({
      selector: domViolation.selector,
      engine: 'dom',
      violationType: domViolation.rule,
      measuredDelta: domViolation.detail,
      fallbackAdvice,
    });

    normalized.push({
      engine: 'dom',
      violationType: domViolation.rule,
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent,
      a2ui,
      selector: domViolation.selector,
      inShadowDom: domViolation.inShadowDom,
      occurrenceCount: 1,
      measuredDelta: domViolation.detail,
      remediationAdvice,
    });
  }

  // 7. Normalize Uncaught Runtime JS (JavaScript) & Console Errors (`runtime`)
  for (const runtimeErr of viewportReport.runtimeErrors ?? new Array()) {
    normalized.push({
      engine: 'runtime',
      violationType: runtimeErr.source,
      url: viewportReport.url,
      viewport: viewportLabel,
      hostComponent: null,
      a2ui: null,
      selector: runtimeErr.location ?? 'window',
      inShadowDom: false,
      occurrenceCount: 1,
      measuredDelta: runtimeErr.message,
      remediationAdvice:
        'Resolve uncaught runtime error (' + runtimeErr.source + '): ' + runtimeErr.message,
    });
  }

  return normalized.map((item) => {
    const loc = viewportReport.sourceLocations?.[item.selector] ?? null;
    const sourceFile = loc?.sourceFile ?? null;
    const lineNumber = loc?.lineNumber ?? null;
    const columnNumber = loc?.columnNumber ?? null;
    const locationSuffix =
      sourceFile && lineNumber !== null
        ? ' (source: ' + sourceFile + ':' + String(lineNumber) + ')'
        : '';

    return {
      ...item,
      sourceFile,
      lineNumber,
      columnNumber,
      remediationAdvice: item.remediationAdvice + locationSuffix,
    };
  });
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
  violations: Array<IAgenticViolation>
): Array<IAgenticViolation> {
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
 * Options controlling JSON stream grouping, priority ranking, and output limits.
 */
export interface IAgenticJsonStreamOptions
  extends Pick<IViolationBudgetOptions, 'top' | 'maxTokens'> {
  /** When true, collapses child failures under their shared parent container or Web Component host. */
  groupByRoot?: boolean;
  /** Workspace root directory used to compute safe `unifiedDiff` patches (`process.cwd()` by default). */
  cwd?: string;
}

export function formatAgenticJsonStream(
  report: ICheckExecutionReport,
  streamOptions: IAgenticJsonStreamOptions = {}
): string {
  const cwd = streamOptions.cwd ?? process.cwd();
  const rawViolations = new Array<IAgenticViolation>();

  for (const viewportResult of report.results) {
    const viewportViolations = normalizeViewportViolations(viewportResult).map((item) => {
      const fix = computeDeterministicAutoFix(item, cwd);
      return {
        ...item,
        unifiedDiff: fix ? fix.unifiedDiff : null,
      };
    });
    rawViolations.push(...viewportViolations);
  }

  const rootGrouped = streamOptions.groupByRoot
    ? groupViolationsByRootCause(rawViolations)
    : rawViolations;

  const deduplicated = deduplicateAgenticViolations(rootGrouped);

  const briefEntries = report.results.filter((r) => r.spatialBrief !== undefined);
  let spatialBrief: string | undefined;
  if (briefEntries.length === 1) {
    spatialBrief = briefEntries.at(0)?.spatialBrief;
  } else if (briefEntries.length > 1) {
    spatialBrief = briefEntries
      .map(
        (r) =>
          `${r.viewport.name} (${r.viewport.width}x${r.viewport.height}): ${
            r.spatialBrief || '(none)'
          }`
      )
      .join(' || ');
  }

  const emptyEnvelopeSize = JSON.stringify(
    {
      tool: 'uirig',
      exitCode: report.exitCode,
      passed: report.exitCode === 0,
      timestamp: report.timestamp,
      ...(spatialBrief !== undefined ? { spatialBrief } : {}),
      totalViolations: deduplicated.length,
      truncatedCount: 0,
      summary: report.summary,
      violations: new Array<IAgenticViolation>(),
    },
    null,
    2
  ).length;

  const budgeted = applyViolationBudget(deduplicated, {
    top: streamOptions.top,
    maxTokens: streamOptions.maxTokens,
    basePayloadOverheadChars: emptyEnvelopeSize,
  });

  const payload: IAgenticJsonStreamPayload = {
    tool: 'uirig',
    exitCode: report.exitCode,
    passed: report.exitCode === 0,
    timestamp: report.timestamp,
    ...(spatialBrief !== undefined ? { spatialBrief } : {}),
    ...(budgeted.truncatedCount > 0
      ? {
          totalViolations: budgeted.totalViolations,
          truncatedCount: budgeted.truncatedCount,
        }
      : {}),
    summary: report.summary,
    violations: budgeted.violations,
  };

  return JSON.stringify(payload, null, 2);
}
