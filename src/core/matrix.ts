/**
 * src/core/matrix.ts
 * Rendered Luminance Contrast Gate (uirig contrast).
 * Uses `colorjs.io` for W3C CSS Color 4 parsing, Porter-Duff alpha layer compositing,
 * and exact WCAG 2.1 contrast ratio verification.
 */

import Color from 'colorjs.io';

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
  foregroundColor: string;
  backgroundLayers: string[];
  inShadowDom: boolean;
  minRatio?: number;
}): IContrastViolation | null {
  const threshold = params.minRatio ?? MIN_WCAG_AA_CONTRAST;

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
      foregroundRgb: formatRgbString(resolvedFg),
      backgroundRgb: formatRgbString(resolvedBg),
      contrastRatio: roundedRatio,
      inShadowDom: params.inShadowDom,
    };
  }

  return null;
}
