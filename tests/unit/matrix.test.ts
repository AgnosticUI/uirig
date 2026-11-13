/**
 * tests/unit/matrix.test.ts
 * Unit tests verifying `colorjs.io` WCAG 2.1 contrast evaluation, Porter-Duff
 * semi-transparent background compositing, nearest passing token suggestions,
 * 4.5:1 legibility thresholds, and `--selectors` subtree scoping.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  auditPageContrast,
  compositeBackgroundStack,
  evaluateContrastEntry,
  findNearestPassingColorToken,
  MIN_WCAG_AA_CONTRAST,
} from '../../src/core/matrix.js';

describe('::: PHASE 3 TASK 3.2 (CHUNK 1): COLORJS.IO CONTRAST & ALPHA COMPOSITING :::', () => {
  let browser: Browser | undefined;

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

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

    const tokenPalette = [
      'rgb(255, 255, 255)',
      'rgb(148, 163, 184)',
      'rgb(71, 85, 105)',
      'rgb(15, 23, 42)',
    ];

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
    expect(result?.suggestedToken).toBe('rgb(71, 85, 105)');
    expect(
      findNearestPassingColorToken('rgb(180, 180, 180)', 'rgb(255, 255, 255)', [
        'rgb(255, 255, 255)',
      ])
    ).toBeUndefined();
  });

  it('==> Should accurately composite semi-transparent overlays over dark backdrops', () => {
    console.log('\n--- START TEST: Semi-Transparent Overlay Alpha Compositing ---');

    const composited = compositeBackgroundStack([
      'rgb(15, 23, 42)',
      'rgba(255, 255, 255, 0.85)',
    ]);
    console.log(`[+] Composited glass backdrop: ${composited.toString({ format: 'rgb' })}`);

    const failingWhiteText = evaluateContrastEntry({
      selector: 'my-modal >> shadow-root >> h2.title',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundLayers: ['rgb(15, 23, 42)', 'rgba(255, 255, 255, 0.85)'],
      inShadowDom: true,
    });

    expect(failingWhiteText).not.toBeNull();
    expect(failingWhiteText?.inShadowDom).toBe(true);
    expect(failingWhiteText?.contrastRatio).toBeLessThan(MIN_WCAG_AA_CONTRAST);

    const passingDarkText = evaluateContrastEntry({
      selector: 'my-modal >> shadow-root >> h2.title',
      foregroundColor: 'rgb(15, 23, 42)',
      backgroundLayers: ['rgb(15, 23, 42)', 'rgba(255, 255, 255, 0.85)'],
      inShadowDom: true,
    });

    expect(passingDarkText).toBeNull();
  });

  it('==> Should scope live contrast violations strictly to --selectors subtrees', async () => {
    console.log('\n--- START TEST: Component-Scoped Contrast Audit (--selectors) ---');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { background: rgb(255, 255, 255); margin: 0; }
            .low-contrast { color: rgb(180, 180, 180); font-size: 16px; }
          </style>
        </head>
        <body>
          <header id="outside-header"><p class="low-contrast">Off-scope contrast fail</p></header>
          <section id="scoped-card"><span class="low-contrast">In-scope contrast fail</span></section>
        </body>
      </html>
    `);

    const scopedViolations = await auditPageContrast(
      page,
      MIN_WCAG_AA_CONTRAST,
      [],
      'contrast',
      [],
      ['#scoped-card']
    );
    await context.close();

    expect(scopedViolations).toHaveLength(1);
    expect(scopedViolations[0]?.selector).toBe('span.low-contrast');
  });
});
