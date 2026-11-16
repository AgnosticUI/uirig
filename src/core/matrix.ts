/**
 * src/core/matrix.ts
 * Rendered Luminance Contrast Gate (uirig contrast).
 * Uses `colorjs.io` for W3C CSS Color 4 parsing, Porter-Duff alpha layer compositing,
 * CSS `opacity` stacking-group unwinding, and exact WCAG 2.1 contrast ratio verification
 * with optional `--selectors` scoping and Shadow DOM `<slot>` background attribution.
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
 * Represents a single DOM or Shadow DOM ancestor's computed background color and CSS `opacity`,
 * ordered from outermost root (`<html>`) down to the target text element.
 */
export interface IAncestorStyleLayer {
  backgroundColor: string;
  opacity: number;
}

/**
 * Raw foreground and ancestor style layer stack extracted from a live text node.
 */
export interface IExtractedTextContrastEntry {
  selector: string;
  hostComponent?: string | null;
  foregroundColor: string;
  backgroundLayers: string[];
  /** Ordered `{ backgroundColor, opacity }` layers from root (`<html>`) to leaf text element. */
  styleLayers?: IAncestorStyleLayer[];
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
      if (parsedBackdrop.contrast(candidate, 'WCAG21') >= minRatio) {
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
 * Blends a source sRGB `Color` over an opaque destination sRGB `Color` using Porter-Duff Source-Over.
 */
function blendOverBackdrop(src: Color, dst: Color, alpha: number): Color {
  if (alpha <= 0) {
    return dst;
  }
  const [srcR, srcG, srcB] = extractSafeRgbCoords(src);
  if (alpha >= 1) {
    return new Color('srgb', [srcR, srcG, srcB], 1);
  }
  const [dstR, dstG, dstB] = extractSafeRgbCoords(dst);
  return new Color(
    'srgb',
    [
      srcR * alpha + dstR * (1 - alpha),
      srcG * alpha + dstG * (1 - alpha),
      srcB * alpha + dstB * (1 - alpha),
    ],
    1
  );
}

/**
 * Composites an ordered stack of CSS background colors (`opacity: 1` assumed for each layer)
 * into a single opaque sRGB `Color`. Preserved for callers evaluating background stacks alone.
 */
export function compositeBackgroundStack(backgroundLayers: string[]): Color {
  const layers: IAncestorStyleLayer[] = backgroundLayers.map((backgroundColor) => ({
    backgroundColor,
    opacity: 1,
  }));
  return compositeContrastLayers(layers, 'rgb(0, 0, 0)').resolvedBg;
}

/**
 * Resolves exact rendered opaque foreground and background `Color` values by modeling both
 * `backgroundColor` alpha layers AND CSS `opacity < 1` stacking groups from `<html>` down
 * through Light DOM and `ShadowRoot.host` ancestors to the leaf text element.
 */
export function compositeContrastLayers(
  styleLayers: IAncestorStyleLayer[],
  foregroundColor: string
): { resolvedFg: Color; resolvedBg: Color } {
  const whiteCanvas = new Color('srgb', Array.of(1, 1, 1) as [number, number, number], 1);
  interface IOpacityGroupFrame {
    opacity: number;
    backdropBeforeGroup: Color;
  }

  let currentBg = whiteCanvas;
  const opacityStack: IOpacityGroupFrame[] = [];

  for (const layer of styleLayers) {
    const clampedOpacity = Math.min(1, Math.max(0, Number.isFinite(layer.opacity) ? layer.opacity : 1));
    if (clampedOpacity < 1) {
      opacityStack.push({ opacity: clampedOpacity, backdropBeforeGroup: currentBg });
    }
    const parsedBg = new Color(layer.backgroundColor).to('srgb');
    const bgAlpha = parsedBg.alpha ?? 1;
    if (bgAlpha > 0) {
      currentBg = blendOverBackdrop(parsedBg, currentBg, bgAlpha);
    }
  }

  const parsedFg = new Color(foregroundColor).to('srgb');
  let currentFg = blendOverBackdrop(parsedFg, currentBg, parsedFg.alpha ?? 1);

  for (let i = opacityStack.length - 1; i >= 0; i--) {
    const frame = opacityStack[i] as IOpacityGroupFrame;
    currentBg = blendOverBackdrop(currentBg, frame.backdropBeforeGroup, frame.opacity);
    currentFg = blendOverBackdrop(currentFg, frame.backdropBeforeGroup, frame.opacity);
  }

  return { resolvedFg: currentFg, resolvedBg: currentBg };
}

/**
 * Evaluates a foreground text color against ancestor background/opacity layers,
 * returning an `IContrastViolation` if WCAG 2.1 contrast drops below `minRatio`.
 */
export function evaluateContrastEntry(params: {
  selector: string;
  hostComponent?: string | null;
  foregroundColor: string;
  backgroundLayers: string[];
  styleLayers?: IAncestorStyleLayer[];
  inShadowDom: boolean;
  minRatio?: number;
  allowedColors?: string[];
}): IContrastViolation | null {
  const threshold = params.minRatio ?? MIN_WCAG_AA_CONTRAST;
  const hostComponent =
    params.hostComponent !== undefined
      ? params.hostComponent
      : extractHostComponentFromSelector(params.selector);

  const effectiveLayers: IAncestorStyleLayer[] =
    params.styleLayers ??
    params.backgroundLayers.map((backgroundColor) => ({ backgroundColor, opacity: 1 }));

  const { resolvedFg, resolvedBg } = compositeContrastLayers(
    effectiveLayers,
    params.foregroundColor
  );

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
 * extracting foreground text colors and ancestor `{ backgroundColor, opacity }` stacks
 * for visible elements that render direct text nodes (or projected `<slot>` text nodes).
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

      // Walk upward from `el` through `parentElement` and `ShadowRoot.host` boundaries,
      // collecting `{ backgroundColor, opacity }` ordered from outermost ancestor down to `el`.
      function collectAncestorStyleLayers(el: Element): IAncestorStyleLayer[] {
        const bottomUpLayers: IAncestorStyleLayer[] = [];
        let current: Element | null = el;

        while (current) {
          const style = window.getComputedStyle(current);
          const parsedOpacity = Number.parseFloat(style.opacity);
          bottomUpLayers.push({
            backgroundColor: style.backgroundColor || 'rgba(0, 0, 0, 0)',
            opacity: Number.isFinite(parsedOpacity) ? parsedOpacity : 1,
          });

          if (current.parentElement) {
            current = current.parentElement;
          } else {
            const rootNode = current.getRootNode();
            current = rootNode instanceof ShadowRoot ? rootNode.host : null;
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
          const styleLayers = collectAncestorStyleLayers(currentNode);
          results.push({
            selector: meta.selector,
            hostComponent: meta.hostComponent,
            foregroundColor: computed.color,
            backgroundLayers: styleLayers.map((layer) => layer.backgroundColor),
            styleLayers,
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
 * and open ShadowRoot boundaries, compositing ancestor backgrounds and opacity groups.
 */
/**
 * High-level runtime contrast auditor that crawls a live Playwright Page across Light DOM
 * and open ShadowRoot boundaries, compositing ancestor backgrounds and opacity groups.
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
