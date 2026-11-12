/**
 * src/core/tokens.ts
 * Shadow-piercing runtime computed style crawler and design token drift auditor.
 * Evaluates live DOM and Shadow DOM elements against approved design system scales,
 * respecting runtime `data-uirig-ignore="tokens|all"` attributes and config `ignore` rules.
 */

import type { Page } from 'playwright';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';

export interface ITokenScaleConfig {
  colors: string[];
  spacing: string[];
  fontSizes: string[];
  radii: string[];
}

export interface ITokenViolation {
  selector: string;
  property:
    | 'color'
    | 'backgroundColor'
    | 'paddingTop'
    | 'paddingBottom'
    | 'paddingLeft'
    | 'paddingRight'
    | 'fontSize'
    | 'borderRadius';
  actualValue: string;
  inShadowDom: boolean;
}

export interface IExtractedElementStyles {
  selector: string;
  inShadowDom: boolean;
  styles: {
    color: string;
    backgroundColor: string;
    paddingTop: string;
    paddingBottom: string;
    paddingLeft: string;
    paddingRight: string;
    fontSize: string;
    borderRadius: string;
  };
}

export function validateComputedStyleEntry(
  entry: IExtractedElementStyles,
  scale: ITokenScaleConfig
): ITokenViolation[] {
  const violations: ITokenViolation[] = [];

  const normalizedAllowedColors = new Set(scale.colors.map((c) => c.toLowerCase().trim()));
  const allowedSpacing = new Set(scale.spacing.map((s) => s.trim()));
  const allowedFontSizes = new Set(scale.fontSizes.map((f) => f.trim()));
  const allowedRadii = new Set(scale.radii.map((r) => r.trim()));

  const normalizedColor = entry.styles.color.toLowerCase().trim();
  if (normalizedColor && !normalizedAllowedColors.has(normalizedColor)) {
    violations.push({
      selector: entry.selector,
      property: 'color',
      actualValue: entry.styles.color,
      inShadowDom: entry.inShadowDom,
    });
  }

  const normalizedBg = entry.styles.backgroundColor.toLowerCase().trim();
  const isTransparent =
    normalizedBg === 'rgba(0, 0, 0, 0)' || normalizedBg === 'transparent' || normalizedBg === '';
  if (!isTransparent && !normalizedAllowedColors.has(normalizedBg)) {
    violations.push({
      selector: entry.selector,
      property: 'backgroundColor',
      actualValue: entry.styles.backgroundColor,
      inShadowDom: entry.inShadowDom,
    });
  }

  const paddingProperties: Array<'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight'> =
    ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'];

  for (const prop of paddingProperties) {
    const val = entry.styles[prop].trim();
    if (val && !allowedSpacing.has(val)) {
      violations.push({
        selector: entry.selector,
        property: prop,
        actualValue: val,
        inShadowDom: entry.inShadowDom,
      });
    }
  }

  const fontSizeVal = entry.styles.fontSize.trim();
  if (fontSizeVal && !allowedFontSizes.has(fontSizeVal)) {
    violations.push({
      selector: entry.selector,
      property: 'fontSize',
      actualValue: fontSizeVal,
      inShadowDom: entry.inShadowDom,
    });
  }

  const radiusVal = entry.styles.borderRadius.trim();
  if (radiusVal && !allowedRadii.has(radiusVal)) {
    violations.push({
      selector: entry.selector,
      property: 'borderRadius',
      actualValue: radiusVal,
      inShadowDom: entry.inShadowDom,
    });
  }

  return violations;
}

export async function extractShadowPiercingStyles(
  page: Page,
  ignoreRules: IUirigIgnoreRule[] = []
): Promise<IExtractedElementStyles[]> {
  logTelemetry(
    'tokens:crawler',
    'Dispatching recursive shadow-piercing TreeWalker into browser sandbox...'
  );

  const ignoreHelperSource = isElementIgnoredInBrowser.toString();

  const extractedNodes = await page.evaluate(
    ({ rules, helperFn }: { rules: IUirigIgnoreRule[]; helperFn: string }): IExtractedElementStyles[] => {
      const checkIgnored = new Function(`return (${helperFn});`)() as typeof isElementIgnoredInBrowser;
      const currentUrl = window.location.href;
      const snapshots: IExtractedElementStyles[] = [];

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
              !checkIgnored(currentNode, 'tokens', currentUrl, rules)
            ) {
              snapshots.push({
                selector: fullSelector,
                inShadowDom: insideShadow,
                styles: {
                  color: computed.color,
                  backgroundColor: computed.backgroundColor,
                  paddingTop: computed.paddingTop,
                  paddingBottom: computed.paddingBottom,
                  paddingLeft: computed.paddingLeft,
                  paddingRight: computed.paddingRight,
                  fontSize: computed.fontSize,
                  borderRadius: computed.borderRadius,
                },
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
      return snapshots;
    },
    { rules: ignoreRules, helperFn: ignoreHelperSource }
  );

  const shadowCount = extractedNodes.filter((n) => n.inShadowDom).length;
  logTelemetry(
    'tokens:crawler',
    `Extracted ${paint(String(extractedNodes.length), 'bold', 'cyan')} visible elements (${paint(
      String(shadowCount),
      'bold',
      'magenta'
    )} inside open Shadow DOM).`
  );

  return extractedNodes;
}

export async function crawlPageTokens(
  page: Page,
  scale: ITokenScaleConfig,
  ignoreRules: IUirigIgnoreRule[] = []
): Promise<ITokenViolation[]> {
  logTelemetry('tokens:audit', 'Starting full viewport design token crawl...');

  const extractedEntries = await extractShadowPiercingStyles(page, ignoreRules);

  const allViolations: ITokenViolation[] = [];
  for (const entry of extractedEntries) {
    const nodeViolations = validateComputedStyleEntry(entry, scale);
    allViolations.push(...nodeViolations);
  }

  const countBadge =
    allViolations.length > 0
      ? paint(String(allViolations.length), 'bold', 'red')
      : paint('0', 'bold', 'green');

  logTelemetry('tokens:audit', `Crawl complete. Total violations detected: ${countBadge}`);

  return allViolations;
}
