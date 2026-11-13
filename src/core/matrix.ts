/**
 * src/core/matrix.ts
 * Rendered Luminance Contrast Gate (uirig contrast).
 * Uses `colorjs.io` for W3C CSS Color 4 parsing, Porter-Duff alpha layer compositing,
 * and exact WCAG 2.1 contrast ratio verification with optional `--selectors` scoping
 * and Shadow DOM `<slot>` background attribution.
 */

import Color from 'colorjs.io';
import type { Page } from 'playwright';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
import { isElementInSelectorScope } from '../utils/scope.js';
import {
  createBrowserDomWalker,
  extractHostComponentFromSelector,
} from '../utils/dom-walker.js';

/**
 * WCAG 2.1 Level AA minimum contrast ratio required for standard body text.
 * Pairs yielding a ratio strictly below 4.5:1 fail compilation with POSIX exit code 1.
 */
export const MIN_WCAG_AA_CONTRAST = 4.5;

/**
 * Represents a single rendered text element whose computed contrast ratio
 * failed the minimum WCAG 2.1 threshold.
 */
export interface IContrastViolation {
  /** CSS selector or Shadow DOM breadcrumb identifying the offending text element. */
  selector: string;
  /** Enclosing Web Component custom element tag when inside an open ShadowRoot (e.g., 'ag-button'). */
  hostComponent?: string | null;
  /** The element's resolved foreground text color string. */
  foregroundRgb: string;
  /** The final composited opaque background color resolved behind the element. */
  backgroundRgb: string;
  /** Calculated WCAG 2.1 contrast ratio rounded to 2 decimal places (e.g., 2.84). */
  contrastRatio: number;
  /** Nearest passing color token from `tokensPath` when available. */
  suggestedToken?: string;
  /** True if the offending text element resides inside an open ShadowRoot. */
  inShadowDom: boolean;
}

/**
 * Raw foreground and ancestor background layer snapshot extracted from a live text node.
 */
export interface IExtractedTextContrastEntry {
  selector: string;
  hostComponent?: string | null;
  foregroundColor: string;
  backgroundLayers: string[];
  inShadowDom: boolean;
}

function extractSafeRgbCoords(color: Color): [number, number, number] {
  const srgb = color.to('srgb');
  const [rawR, rawG, rawB] = srgb.coords;
  return [rawR ?? 0, rawG ?? 0, rawB ?? 0];
}

function formatRgbString(color: Color): string {
  const [r, g, b] = extractSafeRgbCoords(color);
  const r255 = Math.round(Math.min(1, Math.max(0, r)) * 255);
  const g255 = Math.round(Math.min(1, Math.max(0, g)) * 255);
  const b255 = Math.round(Math.min(1, Math.max(0, b)) * 255);
  return `rgb(${r255}, ${g255}, ${b255})`;
}

/**
 * Finds the perceptually closest color token from `allowedColors` (via CIEDE2000 `deltaE`)
 * that achieves at least `minRatio` WCAG 2.1 contrast against `backdropColor`.
 */
export function findNearestPassingColorToken(
  offendingColor: string,
  backdropColor: string,
  allowedColors: string[] = [],
  minRatio: number = MIN_WCAG_AA_CONTRAST
): string | undefined {
  if (allowedColors.length === 0) {
    return undefined;
  }

  let parsedOffending: Color;
  let parsedBackdrop: Color;
  try {
    parsedOffending = new Color(offendingColor).to('srgb');
    parsedBackdrop = new Color(backdropColor).to('srgb');
  } catch {
    return undefined;
  }

  let bestToken: string | undefined;
  let lowestDeltaE = Number.POSITIVE_INFINITY;

  for (const rawCandidate of allowedColors) {
    try {
      const candidate = new Color(rawCandidate).to('srgb');
      if ((candidate.alpha ?? 1) < 1) {
        continue;
      }
      const ratio = parsedBackdrop.contrast(candidate, 'WCAG21');
      if (ratio >= minRatio) {
        const distance = parsedOffending.deltaE(candidate, '2000');
        if (distance < lowestDeltaE) {
          lowestDeltaE = distance;
          bestToken = rawCandidate;
        }
      }
    } catch {
      // Skip non-parseable token entries gracefully
    }
  }

  return bestToken;
}

/**
 * Composites an ordered stack of CSS background colors using Porter-Duff Source-Over
 * alpha blending over a white root canvas.
 */
export function compositeBackgroundStack(backgroundLayers: string[]): Color {
  let accumulated = new Color('srgb', Array.of(1, 1, 1) as [number, number, number], 1);

  for (const rawLayer of backgroundLayers) {
    const parsed = new Color(rawLayer).to('srgb');
    const alpha = parsed.alpha ?? 1;

    if (alpha <= 0) {
      continue;
    }

    const [srcR, srcG, srcB] = extractSafeRgbCoords(parsed);

    if (alpha >= 1) {
      accumulated = new Color('srgb', [srcR, srcG, srcB], 1);
      continue;
    }

    const [dstR, dstG, dstB] = extractSafeRgbCoords(accumulated);
    const blendedR = srcR * alpha + dstR * (1 - alpha);
    const blendedG = srcG * alpha + dstG * (1 - alpha);
    const blendedB = srcB * alpha + dstB * (1 - alpha);

    accumulated = new Color('srgb', [blendedR, blendedG, blendedB], 1);
  }

  return accumulated;
}

/**
 * Evaluates a foreground text color against a stack of ancestor background layers,
 * returning an `IContrastViolation` if the WCAG 2.1 contrast ratio is below `minRatio`.
 */
export function evaluateContrastEntry(params: {
  selector: string;
  hostComponent?: string | null;
  foregroundColor: string;
  backgroundLayers: string[];
  inShadowDom: boolean;
  minRatio?: number;
  allowedColors?: string[];
}): IContrastViolation | null {
  const threshold = params.minRatio ?? MIN_WCAG_AA_CONTRAST;
  const hostComponent =
    params.hostComponent !== undefined
      ? params.hostComponent
      : extractHostComponentFromSelector(params.selector);

  const resolvedBg = compositeBackgroundStack(params.backgroundLayers);
  const parsedFg = new Color(params.foregroundColor).to('srgb');
  const fgAlpha = parsedFg.alpha ?? 1;
  const [fgR, fgG, fgB] = extractSafeRgbCoords(parsedFg);

  const resolvedFg =
    fgAlpha >= 1
      ? new Color('srgb', [fgR, fgG, fgB], 1)
      : compositeBackgroundStack([formatRgbString(resolvedBg), params.foregroundColor]);

  const rawRatio = resolvedBg.contrast(resolvedFg, 'WCAG21');
  const roundedRatio = Math.round(rawRatio * 100) / 100;

  if (rawRatio < threshold) {
    const fgRgb = formatRgbString(resolvedFg);
    const bgRgb = formatRgbString(resolvedBg);
    const suggestedToken = findNearestPassingColorToken(
      fgRgb,
      bgRgb,
      params.allowedColors,
      threshold
    );

    return {
      selector: params.selector,
      hostComponent,
      foregroundRgb: fgRgb,
      backgroundRgb: bgRgb,
      contrastRatio: roundedRatio,
      ...(suggestedToken ? { suggestedToken } : {}),
      inShadowDom: params.inShadowDom,
    };
  }

  return null;
}

/**
 * Crawls a live Playwright Page across Light DOM and open ShadowRoot boundaries,
 * extracting foreground text colors and ancestor background layer stacks for visible
 * elements that render direct text nodes (or projected `<slot>` text nodes).
 */
export async function extractTextContrastSnapshots(
  page: Page,
  ignoreRules: IUirigIgnoreRule[] = [],
  ruleName: string = 'contrast',
  selectors?: string[]
): Promise<IExtractedTextContrastEntry[]> {
  logTelemetry(
    'matrix:crawler',
    'Dispatching shadow-piercing contrast walker into browser sandbox...'
  );

  const snapshots = await page.evaluate(
    ({
      rules,
      activeSelectors,
      walkerFactorySrc,
      ignoreHelperSrc,
      scopeHelperSrc,
      activeRule,
    }: {
      rules: IUirigIgnoreRule[];
      activeSelectors?: string[];
      walkerFactorySrc: string;
      ignoreHelperSrc: string;
      scopeHelperSrc: string;
      activeRule: string;
    }): IExtractedTextContrastEntry[] => {
      const buildWalker = new Function(
        `return (${walkerFactorySrc});`
      )() as typeof createBrowserDomWalker;
      const walker = buildWalker(
        window.location.href,
        rules,
        ignoreHelperSrc,
        activeSelectors,
        scopeHelperSrc
      );
      const results: IExtractedTextContrastEntry[] = [];

      // Only treat direct text nodes NOT projected into a Shadow DOM <slot> as painted by `el`
      function hasDirectUnassignedVisibleText(el: Element): boolean {
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim().length > 0) {
            const textNode = child as Text;
            if (!textNode.assignedSlot) {
              return true;
            }
          }
        }
        return false;
      }

      // When `el` is a <slot>, check whether it projects any direct Light DOM text nodes
      function hasSlottedDirectText(el: Element): boolean {
        if (el.tagName !== 'SLOT') {
          return false;
        }
        const slotEl = el as HTMLSlotElement;
        for (const assigned of slotEl.assignedNodes({ flatten: true })) {
          if (
            assigned.nodeType === Node.TEXT_NODE &&
            (assigned.textContent ?? '').trim().length > 0
          ) {
            return true;
          }
        }
        return false;
      }

      function collectAncestorBackgroundLayers(el: Element): string[] {
        const bottomUpLayers: string[] = [];
        let current: Element | null = el;

        while (current) {
          const bg = window.getComputedStyle(current).backgroundColor;
          if (bg) {
            bottomUpLayers.push(bg);
          }

          if (current.parentElement) {
            current = current.parentElement;
          } else {
            const rootNode = current.getRootNode();
            if (rootNode instanceof ShadowRoot) {
              current = rootNode.host;
            } else {
              current = null;
            }
          }
        }

        return bottomUpLayers.reverse();
      }

      walker.walkElements((currentNode, meta) => {
        const computed = window.getComputedStyle(currentNode);

        if (
          computed.display !== 'none' &&
          computed.visibility !== 'hidden' &&
          (hasDirectUnassignedVisibleText(currentNode) || hasSlottedDirectText(currentNode)) &&
          !walker.isIgnored(currentNode, activeRule)
        ) {
          results.push({
            selector: meta.selector,
            hostComponent: meta.hostComponent,
            foregroundColor: computed.color,
            backgroundLayers: collectAncestorBackgroundLayers(currentNode),
            inShadowDom: meta.inShadowDom,
          });
        }
      });

      return results;
    },
    {
      rules: ignoreRules,
      activeSelectors: selectors,
      walkerFactorySrc: createBrowserDomWalker.toString(),
      ignoreHelperSrc: isElementIgnoredInBrowser.toString(),
      scopeHelperSrc: isElementInSelectorScope.toString(),
      activeRule: ruleName,
    }
  );

  logTelemetry(
    'matrix:crawler',
    `Extracted ${paint(
      String(snapshots.length),
      'bold',
      'cyan'
    )} visible text elements for contrast audit.`
  );

  return snapshots;
}

/**
 * High-level runtime contrast auditor that crawls a live Playwright Page across Light DOM
 * and open ShadowRoot boundaries, compositing ancestor backgrounds and flagging any text
 * pair whose WCAG 2.1 contrast ratio drops below `minRatio` (default 4.5:1).
 */
export async function auditPageContrast(
  page: Page,
  minRatio: number = MIN_WCAG_AA_CONTRAST,
  ignoreRules: IUirigIgnoreRule[] = [],
  ruleName: string = 'contrast',
  allowedColors: string[] = [],
  selectors?: string[]
): Promise<IContrastViolation[]> {
  logTelemetry(
    'matrix:audit',
    `Starting rendered luminance contrast audit (threshold: ${paint(`${minRatio}:1`, 'bold', 'cyan')})...`
  );

  const entries = await extractTextContrastSnapshots(page, ignoreRules, ruleName, selectors);
  const violations: IContrastViolation[] = [];

  for (const entry of entries) {
    const violation = evaluateContrastEntry({
      ...entry,
      minRatio,
      allowedColors,
    });
    if (violation) {
      violations.push(violation);
    }
  }

  const countBadge =
    violations.length > 0
      ? paint(String(violations.length), 'bold', 'red')
      : paint('0', 'bold', 'green');

  logTelemetry('matrix:audit', `Contrast audit complete. Violations detected: ${countBadge}`);

  return violations;
}
