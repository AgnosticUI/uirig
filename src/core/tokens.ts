/**
 * src/core/tokens.ts
 * Shadow-piercing runtime computed style crawler and design token drift auditor.
 * Evaluates live DOM and Shadow DOM elements against approved design system scales.
 */

// Import only the TypeScript type for Playwright's Page so zero runtime bundle weight is added
import type { Page } from 'playwright';
import { formatTelemetryLog, paint } from '../utils/formatter.js';

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
  /** The specific computed CSS property that failed validation (e.g., 'color', 'paddingTop'). */
  property: 'color' | 'backgroundColor' | 'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight' | 'fontSize' | 'borderRadius';
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
 *
 * @param entry - The extracted selector, Shadow DOM flag, and computed CSS properties.
 * @param scale - The approved design system token arrays.
 * @returns An array of detected violations (empty array if the element is compliant).
 */
export function validateComputedStyleEntry(
  entry: IExtractedElementStyles,
  scale: ITokenScaleConfig
): ITokenViolation[] {
  // Collect all token violations discovered on this specific DOM node
  const violations: ITokenViolation[] = [];

  // Normalize approved colors to lowercase so 'RGB(255, 255, 255)' matches 'rgb(255, 255, 255)'
  const normalizedAllowedColors = new Set(scale.colors.map((c) => c.toLowerCase().trim()));
  const allowedSpacing = new Set(scale.spacing.map((s) => s.trim()));
  const allowedFontSizes = new Set(scale.fontSizes.map((f) => f.trim()));
  const allowedRadii = new Set(scale.radii.map((r) => r.trim()));

  // 1. Validate foreground text color
  const normalizedColor = entry.styles.color.toLowerCase().trim();
  if (normalizedColor && !normalizedAllowedColors.has(normalizedColor)) {
    violations.push({
      selector: entry.selector,
      property: 'color',
      actualValue: entry.styles.color,
      inShadowDom: entry.inShadowDom,
    });
  }

  // 2. Validate background color (ignore browser default transparent values to prevent false positives)
  const normalizedBg = entry.styles.backgroundColor.toLowerCase().trim();
  const isTransparent = normalizedBg === 'rgba(0, 0, 0, 0)' || normalizedBg === 'transparent' || normalizedBg === '';
  if (!isTransparent && !normalizedAllowedColors.has(normalizedBg)) {
    violations.push({
      selector: entry.selector,
      property: 'backgroundColor',
      actualValue: entry.styles.backgroundColor,
      inShadowDom: entry.inShadowDom,
    });
  }

  // 3. Validate all four directional padding properties against the approved spacing scale
  const paddingProperties: Array<'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight'> = [
    'paddingTop',
    'paddingBottom',
    'paddingLeft',
    'paddingRight',
  ];

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

  // 4. Validate computed font size against the approved typographic scale
  const fontSizeVal = entry.styles.fontSize.trim();
  if (fontSizeVal && !allowedFontSizes.has(fontSizeVal)) {
    violations.push({
      selector: entry.selector,
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
      property: 'borderRadius',
      actualValue: radiusVal,
      inShadowDom: entry.inShadowDom,
    });
  }

  return violations;
}

/**
 * Executes a recursive TreeWalker inside a live Playwright Page that pierces
 * open ShadowRoot boundaries to extract computed styles from all visible elements.
 *
 * @param page - An active Playwright Page instance loaded with target HTML/URL.
 * @returns An array of extracted style snapshots across both Light DOM and Shadow DOM.
 */
export async function extractShadowPiercingStyles(page: Page): Promise<IExtractedElementStyles[]> {
  console.log(
    formatTelemetryLog(
      'tokens:crawler',
      'Dispatching recursive shadow-piercing TreeWalker into browser sandbox...'
    )
  );


  // page.evaluate serializes this self-contained function and runs it inside Chromium's V8 context
  const extractedNodes = await page.evaluate((): IExtractedElementStyles[] => {
    // Store every visible element's computed style snapshot across all DOM and ShadowRoot levels
    const snapshots: IExtractedElementStyles[] = [];

    // Non-visual structural tags that should never be audited for design tokens
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

    // Helper inside the browser context to format a readable selector string (e.g. 'button.primary-btn')
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

    // Recursive walker that traverses a Document or ShadowRoot and dives into any child ShadowRoots
    function traverseRoot(
      root: Document | ShadowRoot,
      shadowPrefix: string,
      insideShadow: boolean
    ): void {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let currentNode = walker.nextNode() as Element | null;

      while (currentNode) {
        if (!nonVisualTags.has(currentNode.tagName)) {
          // Ask the browser's CSS engine for the final resolved pixel and RGB values
          const computed = window.getComputedStyle(currentNode);
          const elementLabel = formatSelector(currentNode);
          const fullSelector = shadowPrefix ? `${shadowPrefix} >> ${elementLabel}` : elementLabel;

          // Record computed styles only if the element actually renders on screen
          if (computed.display !== 'none') {
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

          // Open vs. Closed ShadowRoot Boundary:
          // `element.shadowRoot` returns the ShadowRoot instance ONLY when attached with `{ mode: 'open' }`.
          // If a Web Component uses `{ mode: 'closed' }`, the browser intentionally returns `null` to standard
          // page scripts (`page.evaluate`), meaning closed shadow trees cannot be traversed without an
          // elevated browser extension or custom Playwright selector engine.
          if (currentNode.shadowRoot) {
            const nextShadowPrefix = `${fullSelector} >> shadow-root`;
            traverseRoot(currentNode.shadowRoot, nextShadowPrefix, true);
          }
        }

        // Advance the iterator to the next sibling/descendant element in the current root
        currentNode = walker.nextNode() as Element | null;
      }
    }

    // Start traversal at the top-level Light DOM document
    traverseRoot(document, '', false);
    return snapshots;
  });

  const shadowCount = extractedNodes.filter((n) => n.inShadowDom).length;
  console.log(
    formatTelemetryLog(
      'tokens:crawler',
      `Extracted ${paint(String(extractedNodes.length), 'bold', 'cyan')} visible elements (${paint(
        String(shadowCount),
        'bold',
        'magenta'
      )} inside open Shadow DOM).`
    )
  );

  return extractedNodes;
}

/**
 * High-level runtime auditor that crawls a live Playwright Page across Light DOM
 * and open ShadowRoot boundaries, then pipes every extracted style snapshot through
 * the pure validateComputedStyleEntry rule engine.
 *
 * Note on Shadow DOM Encapsulation:
 * Only Web Components created with `attachShadow({ mode: 'open' })` expose `element.shadowRoot`
 * to standard `page.evaluate()` scripts. Components using `{ mode: 'closed' }` return `null`
 * for `element.shadowRoot` and are skipped by design.
 *
 * @param page - An active Playwright Page instance pointing to the target viewport.
 * @param scale - The approved design system token configuration.
 * @returns An array of all detected design token violations across the viewport.
 */
export async function crawlPageTokens(
  page: Page,
  scale: ITokenScaleConfig
): Promise<ITokenViolation[]> {
  console.log(formatTelemetryLog('tokens:audit', 'Starting full viewport design token crawl...'));

  // Step 1: Extract live computed styles across Light DOM and open ShadowRoots
  const extractedEntries = await extractShadowPiercingStyles(page);

  // Step 2: Validate every extracted element snapshot against the approved design scale
  const allViolations: ITokenViolation[] = [];
  for (const entry of extractedEntries) {
    const nodeViolations = validateComputedStyleEntry(entry, scale);
    allViolations.push(...nodeViolations);
  }

  const countBadge =
    allViolations.length > 0
      ? paint(String(allViolations.length), 'bold', 'red')
      : paint('0', 'bold', 'green');
  console.log(
    formatTelemetryLog('tokens:audit', `Crawl complete. Total violations detected: ${countBadge}`)
  );
  return allViolations;
}
