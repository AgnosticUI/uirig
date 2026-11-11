/**
 * src/core/tokens.ts
 * Shadow-piercing runtime computed style crawler and design token drift auditor.
 * Evaluates live DOM and Shadow DOM elements against approved design system scales.
 */

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
