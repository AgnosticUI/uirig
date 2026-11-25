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
  /** Optional CSS gradient color stops resolved when `background-clip: text` is active. */
  gradientColors?: string[];
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
 * Splits a CSS argument list by top-level commas while preserving nested parentheses
 * (such as `rgb(...)`, `rgba(...)`, `hsl(...)`, `oklch(...)`, or `calc(...)`).
 */
function splitTopLevelCommaArgs(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (ch === ',' && depth === 0) {
      const segment = input.slice(start, i).trim();
      if (segment.length > 0) {
        parts.push(segment);
      }
      start = i + 1;
    }
  }

  const tail = input.slice(start).trim();
  if (tail.length > 0) {
    parts.push(tail);
  }
  return parts;
}

/**
 * Extracts valid CSS color stop strings from a computed `background-image` containing
 * one or more CSS `gradient(...)` functions (e.g., `linear-gradient(...)`,
 * `-webkit-linear-gradient(...)`, `radial-gradient(...)`, `conic-gradient(...)`).
 */
export function extractGradientColorStops(backgroundImage: string): string[] {
  if (!backgroundImage || !backgroundImage.toLowerCase().includes('gradient(')) {
    return [];
  }

  const colors: string[] = [];
  const gradientHeaderRegex = /(?:-[a-z]+-)?(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = gradientHeaderRegex.exec(backgroundImage)) !== null) {
    const argsStart = match.index + match[0].length;
    let depth = 1;
    let cursor = argsStart;

    while (cursor < backgroundImage.length && depth > 0) {
      const ch = backgroundImage[cursor];
      if (ch === '(') {
        depth++;
      } else if (ch === ')') {
        depth--;
      }
      cursor++;
    }

    if (depth !== 0) {
      continue;
    }

    const innerArgs = backgroundImage.slice(argsStart, cursor - 1);
    const segments = splitTopLevelCommaArgs(innerArgs);

    for (const segment of segments) {
      // Split color stop from optional trailing position/angle stops at top-level whitespace
      const tokens: string[] = [];
      let parenDepth = 0;
      let tokenStart = 0;

      for (let i = 0; i < segment.length; i++) {
        const ch = segment[i];
        if (ch === '(') {
          parenDepth++;
        } else if (ch === ')') {
          parenDepth = Math.max(0, parenDepth - 1);
        } else if (/\s/.test(ch) && parenDepth === 0) {
          const tok = segment.slice(tokenStart, i).trim();
          if (tok.length > 0) {
            tokens.push(tok);
          }
          tokenStart = i + 1;
        }
      }
      const lastTok = segment.slice(tokenStart).trim();
      if (lastTok.length > 0) {
        tokens.push(lastTok);
      }

      if (tokens.length === 0) {
        continue;
      }

      // Color is either the first token (`#bd34fe 30%`) or last token (`30% #bd34fe`)
      const candidates = [tokens[0] as string];
      if (tokens.length > 1) {
        candidates.push(tokens[tokens.length - 1] as string);
      }

      for (const candidate of candidates) {
        // Ignore pure numeric/percentage/angle/length stop positions or keywords like `to`, `at`, `from`
        if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:%|px|em|rem|deg|rad|grad|turn|vw|vh)?$/i.test(candidate)) {
          continue;
        }
        try {
          const parsed = new Color(candidate);
          // Ensure `colorjs.io` actually resolved a valid color space (not an unparsed keyword)
          if (parsed && parsed.space) {
            colors.push(candidate);
            break;
          }
        } catch {
          // Not a CSS color token (e.g. `120deg`, `to`, `circle`)
        }
      }
    }
  }

  return colors;
}

/**
 * Evaluates a foreground text color against ancestor background/opacity layers,
 * returning an `IContrastViolation` if WCAG 2.1 contrast drops below `minRatio`.
 */
export function evaluateContrastEntry(params: {
  selector: string;
  hostComponent?: string | null;
  foregroundColor: string;
  gradientColors?: string[];
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

  const candidateForegrounds =
    params.gradientColors && params.gradientColors.length > 0
      ? params.gradientColors
      : [params.foregroundColor];

  let worstResolvedFg: Color | null = null;
  let worstResolvedBg: Color | null = null;
  let lowestRatio = Number.POSITIVE_INFINITY;

  for (const candidateFg of candidateForegrounds) {
    const { resolvedFg, resolvedBg } = compositeContrastLayers(effectiveLayers, candidateFg);
    const ratio = resolvedBg.contrast(resolvedFg, 'WCAG21');
    if (ratio < lowestRatio) {
      lowestRatio = ratio;
      worstResolvedFg = resolvedFg;
      worstResolvedBg = resolvedBg;
    }
  }

  if (!worstResolvedFg || !worstResolvedBg) {
    return null;
  }

  const roundedRatio = Math.round(lowestRatio * 100) / 100;

  if (lowestRatio < threshold) {
    const fgRgb = formatRgbString(worstResolvedFg);
    const bgRgb = formatRgbString(worstResolvedBg);
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
 * extracting foreground text colors, `background-clip: text` gradient stops, and ancestor
 * `{ backgroundColor, opacity }` stacks for visible elements that render direct text nodes
 * (or projected `<slot>` text nodes).
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

  interface IRawExtractedTextSnapshot extends IExtractedTextContrastEntry {
    clippedBackgroundImage?: string;
  }

  const rawSnapshots = await page.evaluate(
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
    }): IRawExtractedTextSnapshot[] => {
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
      const results: IRawExtractedTextSnapshot[] = [];

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

      // When `el` is the innermost <slot> directly receiving Light DOM text nodes
      // (i.e. not merely forwarding to an inner <slot>), treat `el` as the text carrier.
      function hasSlottedDirectText(el: Element): boolean {
        if (el.tagName !== 'SLOT') {
          return false;
        }
        const slotEl = el as HTMLSlotElement;
        if (slotEl.assignedSlot !== null) {
          return false;
        }
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

      function isTransparentCssColor(rawColor: string): boolean {
        const normalized = rawColor.trim().toLowerCase();
        if (!normalized || normalized === 'transparent') {
          return true;
        }
        const rgbaMatch = normalized.match(
          /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/
        );
        if (rgbaMatch && rgbaMatch[1] !== undefined) {
          return Number.parseFloat(rgbaMatch[1]) <= 0.05;
        }
        const slashAlphaMatch = normalized.match(/\/\s*([\d.]+%?)\s*\)$/);
        if (slashAlphaMatch && slashAlphaMatch[1] !== undefined) {
          const rawAlpha = slashAlphaMatch[1];
          const numericAlpha = rawAlpha.endsWith('%')
            ? Number.parseFloat(rawAlpha) / 100
            : Number.parseFloat(rawAlpha);
          return numericAlpha <= 0.05;
        }
        return false;
      }

      function hasClippedTextGradient(computed: CSSStyleDeclaration): boolean {
        const clip = (
          computed.backgroundClip ||
          computed.getPropertyValue('-webkit-background-clip') ||
          ''
        )
          .trim()
          .toLowerCase();
        if (clip !== 'text') {
          return false;
        }
        const bgImage = (computed.backgroundImage || '').toLowerCase();
        if (!bgImage.includes('gradient(')) {
          return false;
        }
        const textFill =
          computed.getPropertyValue('-webkit-text-fill-color') || computed.color || '';
        return isTransparentCssColor(textFill);
      }

      // Walk upward across the flattened render tree: if `current` is projected into a
      // Shadow DOM `<slot>` (`current.assignedSlot`), climb through that `<slot>` and its
      // enclosing Shadow DOM containers (`<button>`) before exiting via `ShadowRoot.host`.
      function getFlattenedParentElement(el: Element): Element | null {
        if (el.assignedSlot) {
          return el.assignedSlot;
        }
        if (el.parentElement) {
          return el.parentElement;
        }
        const rootNode = el.getRootNode();
        return rootNode instanceof ShadowRoot ? rootNode.host : null;
      }

      // WCAG 2.1 SC 1.4.3 exemption: text that is part of an inactive user interface
      // component (`[disabled]`, `[aria-disabled="true"]`, or inside a disabled `<fieldset>`)
      // across either the flattened render tree or Light DOM ancestry is exempt from contrast checks.
      function isInactiveUiComponent(el: Element): boolean {
        const checkElementDisabled = (node: Element): boolean => {
          if (node.hasAttribute('disabled')) {
            return true;
          }
          const ariaDisabled = (node.getAttribute('aria-disabled') ?? '').trim().toLowerCase();
          if (ariaDisabled === 'true') {
            return true;
          }
          if ('disabled' in node && (node as HTMLButtonElement).disabled === true) {
            return true;
          }
          return false;
        };

        let current: Element | null = el;
        while (current) {
          if (checkElementDisabled(current)) {
            return true;
          }
          current = getFlattenedParentElement(current);
        }

        // Also check Light DOM host ancestors when `el` is a <slot> inside an open ShadowRoot
        // whose Light DOM host element carries `[disabled]` or `[aria-disabled="true"]`.
        let hostCursor: Element | null = el;
        while (hostCursor) {
          if (checkElementDisabled(hostCursor)) {
            return true;
          }
          if (hostCursor.parentElement) {
            hostCursor = hostCursor.parentElement;
          } else {
            const rootNode = hostCursor.getRootNode();
            hostCursor = rootNode instanceof ShadowRoot ? rootNode.host : null;
          }
        }

        return false;
      }

      function isEffectivelyInvisibleOverlay(el: Element): boolean {
        let current: Element | null = el;
        let cumulativeOpacity = 1;

        while (current) {
          const style = window.getComputedStyle(current);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.visibility === 'collapse'
          ) {
            return true;
          }
          const parsedOpacity = Number.parseFloat(style.opacity);
          if (Number.isFinite(parsedOpacity)) {
            cumulativeOpacity *= parsedOpacity;
            if (cumulativeOpacity <= 0.001) {
              return true;
            }
          }
          current = getFlattenedParentElement(current);
        }

        return false;
      }

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
          current = getFlattenedParentElement(current);
        }

        return bottomUpLayers.reverse();
      }

      walker.walkElements((currentNode, meta) => {
        const computed = window.getComputedStyle(currentNode);

        if (
          computed.display !== 'none' &&
          computed.visibility !== 'hidden' &&
          !walker.isVisuallyHidden(currentNode) &&
          !isEffectivelyInvisibleOverlay(currentNode) &&
          (hasDirectUnassignedVisibleText(currentNode) || hasSlottedDirectText(currentNode)) &&
          !isInactiveUiComponent(currentNode) &&
          !walker.isIgnored(currentNode, activeRule)
        ) {
          const clippedGradient = hasClippedTextGradient(computed);
          const styleLayers = collectAncestorStyleLayers(currentNode);

          // When `background-clip: text` is active, the element's own background paints inside
          // the glyph fill rather than as a rectangular backdrop behind the characters.
          if (clippedGradient && styleLayers.length > 0) {
            const leafLayer = styleLayers[styleLayers.length - 1];
            if (leafLayer) {
              leafLayer.backgroundColor = 'rgba(0, 0, 0, 0)';
            }
          }

          results.push({
            selector: meta.selector,
            hostComponent: meta.hostComponent,
            foregroundColor: computed.color,
            ...(clippedGradient ? { clippedBackgroundImage: computed.backgroundImage } : {}),
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

  const snapshots: IExtractedTextContrastEntry[] = rawSnapshots.map(
    ({ clippedBackgroundImage, ...entry }) => {
      if (!clippedBackgroundImage) {
        return entry;
      }
      const gradientColors = extractGradientColorStops(clippedBackgroundImage);
      return gradientColors.length > 0 ? { ...entry, gradientColors } : entry;
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
