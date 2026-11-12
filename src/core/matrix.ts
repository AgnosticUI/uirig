/**
 * src/core/matrix.ts
 * Rendered Luminance Contrast Gate (uirig contrast).
 * Uses `colorjs.io` for W3C CSS Color 4 parsing, Porter-Duff alpha layer compositing,
 * and exact WCAG 2.1 contrast ratio verification, respecting `data-uirig-ignore`
 * and config `ignore` rules.
 */

import Color from 'colorjs.io';
import type { Page } from 'playwright';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';

export const MIN_WCAG_AA_CONTRAST = 4.5;

export interface IContrastViolation {
  selector: string;
  foregroundRgb: string;
  backgroundRgb: string;
  contrastRatio: number;
  inShadowDom: boolean;
}

export interface IExtractedTextContrastEntry {
  selector: string;
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

export function evaluateContrastEntry(params: {
  selector: string;
  foregroundColor: string;
  backgroundLayers: string[];
  inShadowDom: boolean;
  minRatio?: number;
}): IContrastViolation | null {
  const threshold = params.minRatio ?? MIN_WCAG_AA_CONTRAST;

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

export async function extractTextContrastSnapshots(
  page: Page,
  ignoreRules: IUirigIgnoreRule[] = [],
  ruleName: string = 'contrast'
): Promise<IExtractedTextContrastEntry[]> {
  logTelemetry(
    'matrix:crawler',
    'Dispatching shadow-piercing contrast walker into browser sandbox...'
  );

  const ignoreHelperSource = isElementIgnoredInBrowser.toString();

  const snapshots = await page.evaluate(
    ({
      rules,
      helperFn,
      activeRule,
    }: {
      rules: IUirigIgnoreRule[];
      helperFn: string;
      activeRule: string;
    }): IExtractedTextContrastEntry[] => {
      const checkIgnored = new Function(`return (${helperFn});`)() as typeof isElementIgnoredInBrowser;
      const currentUrl = window.location.href;
      const results: IExtractedTextContrastEntry[] = [];

      const nonVisualTags = new Set([
        'HTML',
        'HEAD',
        'SCRIPT',
        'STYLE',
        'META',
        'LINK',
        'NOSCRIPT',
        'TEMPLATE',
        'SLOT',
      ]);

      function formatSelector(el: Element): string {
        const tagName = el.tagName.toLowerCase();
        if (el.id) {
          return `${tagName}#${el.id}`;
        }
        if (typeof el.className === 'string' && el.className.trim().length > 0) {
          const classList = el.className.trim().split(/\s+/).join('.');
          return `${tagName}.${classList}`;
        }
        return tagName;
      }

      function hasDirectVisibleText(el: Element): boolean {
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim().length > 0) {
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

      function traverseRoot(
        root: Document | ShadowRoot,
        shadowPrefix: string,
        insideShadow: boolean
      ): void {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let currentNode = walker.nextNode() as Element | null;

        while (currentNode) {
          if (!nonVisualTags.has(currentNode.tagName)) {
            const computed = window.getComputedStyle(currentNode);
            const elementLabel = formatSelector(currentNode);
            const fullSelector = shadowPrefix ? `${shadowPrefix} >> ${elementLabel}` : elementLabel;

            if (
              computed.display !== 'none' &&
              computed.visibility !== 'hidden' &&
              hasDirectVisibleText(currentNode) &&
              !checkIgnored(currentNode, activeRule, currentUrl, rules)
            ) {
              results.push({
                selector: fullSelector,
                foregroundColor: computed.color,
                backgroundLayers: collectAncestorBackgroundLayers(currentNode),
                inShadowDom: insideShadow,
              });
            }

            if (currentNode.shadowRoot) {
              const nextShadowPrefix = `${fullSelector} >> shadow-root`;
              traverseRoot(currentNode.shadowRoot, nextShadowPrefix, true);
            }
          }

          currentNode = walker.nextNode() as Element | null;
        }
      }

      traverseRoot(document, '', false);
      return results;
    },
    { rules: ignoreRules, helperFn: ignoreHelperSource, activeRule: ruleName }
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
