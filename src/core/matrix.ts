/**
 * src/core/matrix.ts
 * Rendered Luminance Contrast Gate (uirig contrast).
 * Uses `colorjs.io` for W3C CSS Color 4 parsing, Porter-Duff alpha layer compositing,
 * and exact WCAG 2.1 contrast ratio verification.
 */

import Color from 'colorjs.io';
import type { Page } from 'playwright';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
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

/**
 * Helper to extract strictly numeric [r, g, b] coordinates from a Color instance,
 * defaulting any CSS Color 4 `none` (`null`) channels to `0`.
 */
function extractSafeRgbCoords(color: Color): [number, number, number] {
  const srgb = color.to('srgb');
  const [rawR, rawG, rawB] = srgb.coords;
  return [rawR ?? 0, rawG ?? 0, rawB ?? 0];
}

/**
 * Formats an sRGB Color instance as a standard 8-bit integer `rgb(r, g, b)` string
 * (e.g., `'rgb(255, 255, 255)'`) rather than `colorjs.io`'s percentage format (`'rgb(100% 100% 100%)'`).
 */
function formatRgbString(color: Color): string {
  const [r, g, b] = extractSafeRgbCoords(color);
  const r255 = Math.round(Math.min(1, Math.max(0, r)) * 255);
  const g255 = Math.round(Math.min(1, Math.max(0, g)) * 255);
  const b255 = Math.round(Math.min(1, Math.max(0, b)) * 255);
  return `rgb(${r255}, ${g255}, ${b255})`;
}

/**
 * Composites an ordered stack of CSS background colors (ordered from bottom-most
 * opaque backdrop up to the element's own background) into a single opaque sRGB Color.
 *
 * Think of this like stacking sheets of colored glass on top of a white piece of paper:
 * completely transparent layers (alpha <= 0) are clear glass and get skipped; completely
 * opaque layers (alpha >= 1) act like solid paint and completely block everything beneath
 * them; and semi-transparent layers (0 < alpha < 1) act like tinted glass, blending their
 * own color with whatever accumulated color is showing through from underneath.
 *
 * Uses standard Porter-Duff "Source-Over" alpha blending:
 *   outChannel = srcChannel * srcAlpha + dstChannel * (1 - srcAlpha)
 *
 * @param backgroundLayers - CSS color strings ordered from deepest ancestor to target element.
 * @returns A fully opaque `Color` instance in the `srgb` color space.
 */
export function compositeBackgroundStack(backgroundLayers: string[]): Color {
  // Start with a solid white canvas (r=1, g=1, b=1) as the browser's default root backdrop
  let accumulated = new Color('srgb', Array.of(1, 1, 1) as [number, number, number], 1);

  for (const rawLayer of backgroundLayers) {
    // Parse any CSS Color 4 string (rgb, rgba, color(srgb ...), etc.) and convert to sRGB
    const parsed = new Color(rawLayer).to('srgb');
    const alpha = parsed.alpha ?? 1;

    // Skip completely transparent layers (alpha === 0) since they contribute zero pigment
    if (alpha <= 0) {
      continue;
    }

    const [srcR, srcG, srcB] = extractSafeRgbCoords(parsed);

    // If the layer is completely opaque (alpha >= 1), it completely replaces everything beneath it
    if (alpha >= 1) {
      accumulated = new Color('srgb', [srcR, srcG, srcB], 1);
      continue;
    }

    // Extract current accumulated backdrop channels as strict numbers
    const [dstR, dstG, dstB] = extractSafeRgbCoords(accumulated);

    // Blend semi-transparent layer over the accumulated opaque backdrop channel-by-channel
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
 *
 * @param params - Selector metadata, foreground CSS color, ordered background layers, and threshold.
 * @returns An `IContrastViolation` object if contrast fails, or `null` if legible.
 */
export function evaluateContrastEntry(params: {
  selector: string;
  hostComponent?: string | null;
  foregroundColor: string;
  backgroundLayers: string[];
  inShadowDom: boolean;
  minRatio?: number;
}): IContrastViolation | null {
  const threshold = params.minRatio ?? MIN_WCAG_AA_CONTRAST;
  const hostComponent =
    params.hostComponent !== undefined
      ? params.hostComponent
      : extractHostComponentFromSelector(params.selector);

  // Step 1: Resolve the true opaque background color behind the text
  const resolvedBg = compositeBackgroundStack(params.backgroundLayers);

  // Step 2: Parse the foreground text color and composite it over the resolved background
  // in case the text itself uses semi-transparent `rgba(...)` or `opacity`
  const parsedFg = new Color(params.foregroundColor).to('srgb');
  const fgAlpha = parsedFg.alpha ?? 1;
  const [fgR, fgG, fgB] = extractSafeRgbCoords(parsedFg);

  const resolvedFg =
    fgAlpha >= 1
      ? new Color('srgb', [fgR, fgG, fgB], 1)
      : compositeBackgroundStack([formatRgbString(resolvedBg), params.foregroundColor]);

  // Step 3: Compute exact WCAG 2.1 luminance contrast ratio via colorjs.io
  const rawRatio = resolvedBg.contrast(resolvedFg, 'WCAG21');
  const roundedRatio = Math.round(rawRatio * 100) / 100;

  if (rawRatio < threshold) {
    return {
      selector: params.selector,
      hostComponent,
      foregroundRgb: formatRgbString(resolvedFg),
      backgroundRgb: formatRgbString(resolvedBg),
      contrastRatio: roundedRatio,
      inShadowDom: params.inShadowDom,
    };
  }

  return null;
}

/**
 * Crawls a live Playwright Page across Light DOM and open ShadowRoot boundaries,
 * extracting foreground text colors and ancestor background layer stacks for all
 * visible elements that render direct text nodes.
 *
 * @param page - An active Playwright Page instance loaded with target HTML/URL.
 * @param ignoreRules - Optional runtime ignore rules from `uirig.config.json`.
 * @param ruleName - Active rule identifier (`'contrast'` or `'dark-mode'`).
 * @returns An array of extracted text contrast snapshots ready for `evaluateContrastEntry`.
 */
export async function extractTextContrastSnapshots(
  page: Page,
  ignoreRules: IUirigIgnoreRule[] = [],
  ruleName: string = 'contrast'
): Promise<IExtractedTextContrastEntry[]> {
  logTelemetry(
    'matrix:crawler',
    'Dispatching shadow-piercing contrast walker into browser sandbox...'
  );

  const snapshots = await page.evaluate(
    ({
      rules,
      walkerFactorySrc,
      ignoreHelperSrc,
      activeRule,
    }: {
      rules: IUirigIgnoreRule[];
      walkerFactorySrc: string;
      ignoreHelperSrc: string;
      activeRule: string;
    }): IExtractedTextContrastEntry[] => {
      const buildWalker = new Function(
        `return (${walkerFactorySrc});`
      )() as typeof createBrowserDomWalker;
      const walker = buildWalker(window.location.href, rules, ignoreHelperSrc);
      const results: IExtractedTextContrastEntry[] = [];

      // Check if an element directly owns at least one non-whitespace text node
      function hasDirectVisibleText(el: Element): boolean {
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim().length > 0) {
            return true;
          }
        }
        return false;
      }

      // Walk upward from `el` through `parentElement` and `ShadowRoot.host` boundaries,
      // collecting background colors ordered from outermost ancestor down to `el`.
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
            // If we hit the top of a ShadowRoot, jump out to its host Web Component element
            const rootNode = current.getRootNode();
            if (rootNode instanceof ShadowRoot) {
              current = rootNode.host;
            } else {
              current = null;
            }
          }
        }

        // Reverse so layers are ordered from outermost backdrop (<html>) to innermost element
        return bottomUpLayers.reverse();
      }

      walker.walkElements((currentNode, meta) => {
        const computed = window.getComputedStyle(currentNode);

        if (
          computed.display !== 'none' &&
          computed.visibility !== 'hidden' &&
          hasDirectVisibleText(currentNode) &&
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
      walkerFactorySrc: createBrowserDomWalker.toString(),
      ignoreHelperSrc: isElementIgnoredInBrowser.toString(),
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
 *
 * @param page - An active Playwright Page instance pointing to the target viewport.
 * @param minRatio - Optional custom contrast threshold (defaults to WCAG AA 4.5:1).
 * @param ignoreRules - Optional runtime ignore rules from `uirig.config.json`.
 * @param ruleName - Active rule identifier (`'contrast'` or `'dark-mode'`).
 * @returns An array of detected contrast violations across the viewport.
 */
export async function auditPageContrast(
  page: Page,
  minRatio: number = MIN_WCAG_AA_CONTRAST,
  ignoreRules: IUirigIgnoreRule[] = [],
  ruleName: string = 'contrast'
): Promise<IContrastViolation[]> {
  logTelemetry(
    'matrix:audit',
    `Starting rendered luminance contrast audit (threshold: ${paint(`${minRatio}:1`, 'bold', 'cyan')})...`
  );

  const entries = await extractTextContrastSnapshots(page, ignoreRules, ruleName);
  const violations: IContrastViolation[] = [];

  for (const entry of entries) {
    const violation = evaluateContrastEntry({
      ...entry,
      minRatio,
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
