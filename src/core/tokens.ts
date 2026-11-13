/**
 * src/core/tokens.ts
 * Shadow-piercing runtime computed style crawler and design token drift auditor.
 * Evaluates live DOM and Shadow DOM elements against approved design system scales,
 * with optional `--selectors` subtree scoping.
 */

import type { Page } from 'playwright';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
import { isElementInSelectorScope } from '../utils/scope.js';
import {
  createBrowserDomWalker,
  extractHostComponentFromSelector,
} from '../utils/dom-walker.js';

/**
 * Defines the approved design system values that rendered DOM elements are allowed to use.
 * Any computed style outside these arrays will be flagged as design token drift.
 */
export interface ITokenScaleConfig {
  /** Approved colors normalized to lowercase RGB/RGBA or hex strings (e.g., 'rgb(15, 23, 42)'). */
  colors: string[];
  /** Approved spacing values in pixels for padding/margin (e.g., '0px', '8px', '16px'). */
  spacing: string[];
  /** Approved font sizes in pixels (e.g., '14px', '16px', '24px'). */
  fontSizes: string[];
  /** Approved border-radius values in pixels (e.g., '0px', '4px', '8px'). */
  radii: string[];
}

/**
 * Represents a single design token violation caught on a live rendered element.
 */
export interface ITokenViolation {
  /** CSS selector or tag path identifying the offending element (e.g., 'button.cta-btn'). */
  selector: string;
  /** Enclosing Web Component custom element tag when inside an open ShadowRoot (e.g., 'ag-button'). */
  hostComponent?: string | null;
  /** The specific computed CSS property that failed validation (e.g., 'color', 'paddingTop'). */
  property:
    | 'color'
    | 'backgroundColor'
    | 'paddingTop'
    | 'paddingBottom'
    | 'paddingLeft'
    | 'paddingRight'
    | 'fontSize'
    | 'borderRadius';
  /** The actual runtime value computed by the browser (e.g., 'rgb(255, 0, 128)' or '13px'). */
  actualValue: string;
  /** True if the offending element was discovered inside a Web Component ShadowRoot. */
  inShadowDom: boolean;
}

/**
 * Raw computed style snapshot extracted from a single DOM node inside Playwright.
 */
export interface IExtractedElementStyles {
  selector: string;
  hostComponent?: string | null;
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

/**
 * Pure validation helper that compares a single element's extracted computed styles
 * against the project's approved design token scale.
 */
export function validateComputedStyleEntry(
  entry: IExtractedElementStyles,
  scale: ITokenScaleConfig
): ITokenViolation[] {
  const violations: ITokenViolation[] = [];
  const hostComponent =
    entry.hostComponent !== undefined
      ? entry.hostComponent
      : extractHostComponentFromSelector(entry.selector);

  const normalizedAllowedColors = new Set(scale.colors.map((c) => c.toLowerCase().trim()));
  const allowedSpacing = new Set(scale.spacing.map((s) => s.trim()));
  const allowedFontSizes = new Set(scale.fontSizes.map((f) => f.trim()));
  const allowedRadii = new Set(scale.radii.map((r) => r.trim()));

  // 1. Validate foreground text color
  const normalizedColor = entry.styles.color.toLowerCase().trim();
  if (normalizedColor && !normalizedAllowedColors.has(normalizedColor)) {
    violations.push({
      selector: entry.selector,
      hostComponent,
      property: 'color',
      actualValue: entry.styles.color,
      inShadowDom: entry.inShadowDom,
    });
  }

  // 2. Validate background color (ignore browser default transparent values to prevent false positives)
  const normalizedBg = entry.styles.backgroundColor.toLowerCase().trim();
  const isTransparent =
    normalizedBg === 'rgba(0, 0, 0, 0)' || normalizedBg === 'transparent' || normalizedBg === '';
  if (!isTransparent && !normalizedAllowedColors.has(normalizedBg)) {
    violations.push({
      selector: entry.selector,
      hostComponent,
      property: 'backgroundColor',
      actualValue: entry.styles.backgroundColor,
      inShadowDom: entry.inShadowDom,
    });
  }

  // 3. Validate all four directional padding properties against the approved spacing scale
  const paddingProperties: Array<'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight'> =
    ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'];

  for (const prop of paddingProperties) {
    const val = entry.styles[prop].trim();
    if (val && !allowedSpacing.has(val)) {
      violations.push({
        selector: entry.selector,
        hostComponent,
        property: prop,
        actualValue: val,
        inShadowDom: entry.inShadowDom,
      });
    }
  }

  // 4. Validate computed font size against the approved typographic scale
  const fontSizeVal = entry.styles.fontSize.trim();
  if (fontSizeVal && !allowedFontSizes.has(fontSizeVal)) {
    violations.push({
      selector: entry.selector,
      hostComponent,
      property: 'fontSize',
      actualValue: fontSizeVal,
      inShadowDom: entry.inShadowDom,
    });
  }

  // 5. Validate computed border radius against the approved geometry scale
  const radiusVal = entry.styles.borderRadius.trim();
  if (radiusVal && !allowedRadii.has(radiusVal)) {
    violations.push({
      selector: entry.selector,
      hostComponent,
      property: 'borderRadius',
      actualValue: radiusVal,
      inShadowDom: entry.inShadowDom,
    });
  }

  return violations;
}
/**
 * Executes a recursive TreeWalker inside a live Playwright Page that pierces
 * open ShadowRoot boundaries to extract computed styles from all visible elements
 * (optionally filtered to subtrees matching `selectors`).
 */
export async function extractShadowPiercingStyles(
  page: Page,
  ignoreRules: IUirigIgnoreRule[] = [],
  selectors?: string[]
): Promise<IExtractedElementStyles[]> {
  logTelemetry(
    'tokens:crawler',
    'Dispatching recursive shadow-piercing TreeWalker into browser sandbox...'
  );

  const extractedNodes = await page.evaluate(
    ({
      rules,
      activeSelectors,
      walkerFactorySrc,
      ignoreHelperSrc,
      scopeHelperSrc,
    }: {
      rules: IUirigIgnoreRule[];
      activeSelectors?: string[];
      walkerFactorySrc: string;
      ignoreHelperSrc: string;
      scopeHelperSrc: string;
    }): IExtractedElementStyles[] => {
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

      const snapshots: IExtractedElementStyles[] = [];

      walker.walkElements((currentNode, meta) => {
        const computed = window.getComputedStyle(currentNode);

        if (computed.display !== 'none' && !walker.isIgnored(currentNode, 'tokens')) {
          snapshots.push({
            selector: meta.selector,
            hostComponent: meta.hostComponent,
            inShadowDom: meta.inShadowDom,
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
      });

      return snapshots;
    },
    {
      rules: ignoreRules,
      activeSelectors: selectors,
      walkerFactorySrc: createBrowserDomWalker.toString(),
      ignoreHelperSrc: isElementIgnoredInBrowser.toString(),
      scopeHelperSrc: isElementInSelectorScope.toString(),
    }
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

/**
 * High-level runtime auditor that crawls a live Playwright Page across Light DOM
 * and open ShadowRoot boundaries, then pipes every extracted style snapshot through
 * the pure validateComputedStyleEntry rule engine.
 */
export async function crawlPageTokens(
  page: Page,
  scale: ITokenScaleConfig,
  ignoreRules: IUirigIgnoreRule[] = [],
  selectors?: string[]
): Promise<ITokenViolation[]> {
  logTelemetry('tokens:audit', 'Starting full viewport design token crawl...');

  const extractedEntries = await extractShadowPiercingStyles(page, ignoreRules, selectors);

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
