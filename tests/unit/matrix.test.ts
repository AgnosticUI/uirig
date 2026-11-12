/**
 * tests/unit/matrix.test.ts
 * Unit tests verifying `colorjs.io` WCAG 2.1 contrast evaluation, Porter-Duff
 * semi-transparent background compositing, nearest passing token suggestions,
 * and 4.5:1 legibility thresholds.
 */
import { describe, it, expect } from 'vitest';
import {
  compositeBackgroundStack,
  evaluateContrastEntry,
  findNearestPassingColorToken,
  MIN_WCAG_AA_CONTRAST,
} from '../../src/core/matrix.js';

describe('::: PHASE 3 TASK 3.2 (CHUNK 1): COLORJS.IO CONTRAST & ALPHA COMPOSITING :::', () => {
  it('==> Should pass high-contrast black text on a white background (21:1 ratio)', () => {
    console.log('\n--- START TEST: High-Contrast Black on White (21:1) ---');

    const result = evaluateContrastEntry({
      selector: 'p.article-body',
      foregroundColor: 'rgb(0, 0, 0)',
      backgroundLayers: ['rgb(255, 255, 255)'],
      inShadowDom: false,
    });

    console.log(`[+] Contrast check result (expected null): ${result}`);
    expect(result).toBeNull();
  });

  it('==> Should catch low-contrast light gray text on a white background (< 4.5:1) and suggest nearest passing token', () => {
    console.log('\n--- START TEST: Low-Contrast Light Gray on White Failure + Token Suggestion ---');

    const tokenPalette = ['rgb(255, 255, 255)', 'rgb(148, 163, 184)', 'rgb(71, 85, 105)', 'rgb(15, 23, 42)'];

    const result = evaluateContrastEntry({
      selector: 'span.muted-caption',
      foregroundColor: 'rgb(180, 180, 180)',
      backgroundLayers: ['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'],
      inShadowDom: false,
      allowedColors: tokenPalette,
    });

    console.log('[!] Contrast violation caught:', JSON.stringify(result, null, 2));

    expect(result).not.toBeNull();
    expect(result?.selector).toBe('span.muted-caption');
    expect(result?.contrastRatio).toBeLessThan(MIN_WCAG_AA_CONTRAST);
    expect(result?.backgroundRgb).toBe('rgb(255, 255, 255)');
    // rgb(148, 163, 184) fails 4.5:1 on white (~2.57:1), so nearest passing token is rgb(71, 85, 105) (~5.63:1)
    expect(result?.suggestedToken).toBe('rgb(71, 85, 105)');
    expect(findNearestPassingColorToken('rgb(180, 180, 180)', 'rgb(255, 255, 255)', ['rgb(255, 255, 255)'])).toBeUndefined();
  });

  it('==> Should accurately composite semi-transparent overlays over dark backdrops', () => {
    console.log('\n--- START TEST: Semi-Transparent Overlay Alpha Compositing ---');

    // Layer 1: Dark slate container rgb(15, 23, 42)
    // Layer 2: Semi-transparent white glass card rgba(255, 255, 255, 0.85)
    // Resulting composited background is very light (~rgb(219, 220, 223))
    const composited = compositeBackgroundStack([
      'rgb(15, 23, 42)',
      'rgba(255, 255, 255, 0.85)',
    ]);
    console.log(`[+] Composited glass backdrop: ${composited.toString({ format: 'rgb' })}`);

    // White text on top of that 85%-white glass card must fail contrast!
    const failingWhiteText = evaluateContrastEntry({
      selector: 'my-modal >> shadow-root >> h2.title',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundLayers: ['rgb(15, 23, 42)', 'rgba(255, 255, 255, 0.85)'],
      inShadowDom: true,
    });
    console.log('[!] White text on frosted glass violation:', JSON.stringify(failingWhiteText, null, 2));

    expect(failingWhiteText).not.toBeNull();
    expect(failingWhiteText?.inShadowDom).toBe(true);
    expect(failingWhiteText?.contrastRatio).toBeLessThan(MIN_WCAG_AA_CONTRAST);

    // Dark slate text on top of that same frosted glass card must pass!
    const passingDarkText = evaluateContrastEntry({
      selector: 'my-modal >> shadow-root >> h2.title',
      foregroundColor: 'rgb(15, 23, 42)',
      backgroundLayers: ['rgb(15, 23, 42)', 'rgba(255, 255, 255, 0.85)'],
      inShadowDom: true,
    });
    console.log(`[+] Dark text on frosted glass result (expected null): ${passingDarkText}`);

    expect(passingDarkText).toBeNull();
  });
});
