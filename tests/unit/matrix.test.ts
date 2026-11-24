/**
 * tests/unit/matrix.test.ts
 * Unit & live Chromium specs verifying `colorjs.io` WCAG 2.1 contrast evaluation,
 * Porter-Duff semi-transparent background compositing, ancestor CSS `opacity` stacking
 * group compositing across Light + Shadow DOM, nearest passing token suggestions,
 * `--selectors` component scoping, and Shadow DOM `<slot>` background resolution.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  auditPageContrast,
  compositeBackgroundStack,
  compositeContrastLayers,
  evaluateContrastEntry,
  extractGradientColorStops,
  findNearestPassingColorToken,
  MIN_WCAG_AA_CONTRAST,
} from '../../src/core/matrix.js';

describe('::: PHASE 3 TASK 3.2 + ISSUE #7 (CHUNK 1): COLORJS.IO CONTRAST, ALPHA & OPACITY COMPOSITING :::', () => {
  let browser: Browser | undefined;

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('==> Should pass high-contrast black text on a white background (21:1 ratio)', () => {
    const result = evaluateContrastEntry({
      selector: 'p.article-body',
      foregroundColor: 'rgb(0, 0, 0)',
      backgroundLayers: ['rgb(255, 255, 255)'],
      inShadowDom: false,
    });
    expect(result).toBeNull();
  });

  it('==> Should catch low-contrast light gray text on a white background (< 4.5:1) and suggest nearest passing token', () => {
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
    const composited = compositeBackgroundStack([
      'rgb(15, 23, 42)',
      'rgba(255, 255, 255, 0.85)',
    ]);
    expect(composited).toBeDefined();

    const failingWhiteText = evaluateContrastEntry({
      selector: 'my-modal >> shadow-root >> h2.title',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundLayers: ['rgb(15, 23, 42)', 'rgba(255, 255, 255, 0.85)'],
      inShadowDom: true,
    });
    expect(failingWhiteText?.contrastRatio).toBeLessThan(MIN_WCAG_AA_CONTRAST);

    const passingDarkText = evaluateContrastEntry({
      selector: 'my-modal >> shadow-root >> h2.title',
      foregroundColor: 'rgb(15, 23, 42)',
      backgroundLayers: ['rgb(15, 23, 42)', 'rgba(255, 255, 255, 0.85)'],
      inShadowDom: true,
    });
    expect(passingDarkText).toBeNull();
  });

    it('==> Should restrict contrast violations to --selectors subtrees in live Chromium', async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; background: rgb(255, 255, 255); color: rgb(15, 23, 42); font-size: 16px; }
            #off-scope-footer { color: rgb(210, 210, 210); }
            #target-card .scoped-muted { color: rgb(200, 200, 200); }
          </style>
        </head>
        <body>
          <footer id="off-scope-footer">Off-scope low contrast</footer>
          <div id="target-card">
            <span class="scoped-muted">Scoped low contrast</span>
          </div>
        </body>
      </html>
    `);

    const violations = await auditPageContrast(
      page,
      MIN_WCAG_AA_CONTRAST,
      [],
      'contrast',
      [],
      ['#target-card']
    );
    await context.close();

    expect(violations).toHaveLength(1);
    expect(violations.at(0)?.selector).toBe('span.scoped-muted');
  });

  it('==> Should pass high-contrast slotted text and catch low-contrast slotted text inside ShadowRoot buttons', async () => {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; background: rgb(255, 255, 255); }
            ag-button { color: rgb(240, 246, 252); background: transparent; }
          </style>
        </head>
        <body>
          <ag-button id="good-btn" data-bg="rgb(17, 24, 39)">Monochrome</ag-button>
          <ag-button id="bad-btn" data-bg="rgb(229, 231, 235)">Monochrome Disabled</ag-button>
          <script>
            class AgButton extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                const bg = this.getAttribute('data-bg') || 'rgb(17, 24, 39)';
                shadow.innerHTML =
                  '<button style="background: ' + bg + '; color: rgb(240, 246, 252); padding: 8px 16px;">' +
                    '<slot></slot>' +
                  '</button>';
              }
            }
            customElements.define('ag-button', AgButton);
          </script>
        </body>
      </html>
    `);

    const violations = await auditPageContrast(page, MIN_WCAG_AA_CONTRAST);
    await context.close();

    expect(violations).toHaveLength(1);
    expect(violations.at(0)?.selector).toBe('ag-button#bad-btn >> shadow-root >> slot');
    expect(violations.at(0)?.hostComponent).toBe('ag-button');
    expect(violations.at(0)?.contrastRatio).toBeLessThan(MIN_WCAG_AA_CONTRAST);
  });

  it('==> Should composite ancestor CSS opacity stacking groups across Light DOM host and Shadow DOM children', () => {
    const safeDefault = compositeContrastLayers(
      [{ backgroundColor: 'rgb(255, 255, 255)', opacity: Number.NaN }],
      'rgb(0, 0, 0)'
    );
    expect(safeDefault.resolvedFg.contrast(safeDefault.resolvedBg, 'WCAG21')).toBeCloseTo(21, 1);

    const opaquePass = evaluateContrastEntry({
      selector: 'ag-button >> shadow-root >> button.btn',
      hostComponent: 'ag-button',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundLayers: ['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)', 'rgb(37, 99, 235)'],
      styleLayers: [
        { backgroundColor: 'rgb(255, 255, 255)', opacity: 1 },
        { backgroundColor: 'rgba(0, 0, 0, 0)', opacity: 1 },
        { backgroundColor: 'rgb(37, 99, 235)', opacity: 1 },
      ],
      inShadowDom: true,
    });
    expect(opaquePass).toBeNull();

    const fadedFail = evaluateContrastEntry({
      selector: 'ag-button >> shadow-root >> button.btn',
      hostComponent: 'ag-button',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundLayers: ['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)', 'rgb(37, 99, 235)'],
      styleLayers: [
        { backgroundColor: 'rgb(255, 255, 255)', opacity: 1 },
        { backgroundColor: 'rgba(0, 0, 0, 0)', opacity: 0.6 },
        { backgroundColor: 'rgb(37, 99, 235)', opacity: 1 },
      ],
      inShadowDom: true,
    });

    expect(fadedFail).not.toBeNull();
    expect(fadedFail?.hostComponent).toBe('ag-button');
    expect(fadedFail?.contrastRatio).toBeLessThan(MIN_WCAG_AA_CONTRAST);
  });

  it('==> Should detect live Chromium contrast failure when a Light DOM Web Component host sets opacity: 0.6', async () => {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 24px; background: #ffffff; }
            ag-button { display: inline-block; opacity: 0.6; }
          </style>
        </head>
        <body>
          <ag-button>Submit</ag-button>
          <script>
            class AgButton extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.innerHTML =
                  '<button style="background: #2563eb; color: #ffffff; border: 0; padding: 8px 16px;">' +
                    'Submit' +
                  '</button>';
              }
            }
            customElements.define('ag-button', AgButton);
          </script>
        </body>
      </html>
    `);

    const violations = await auditPageContrast(page);
    await context.close();

    expect(violations.length).toBe(1);
    expect(violations.at(0)?.hostComponent).toBe('ag-button');
    expect(violations.at(0)?.inShadowDom).toBe(true);
    expect(violations.at(0)?.contrastRatio).toBeLessThan(MIN_WCAG_AA_CONTRAST);
  });

    it('==> Should evaluate worst-case gradient color stop luminance when gradientColors are provided', () => {
    // VitePress-style gradient (#bd34fe + #41d1ff) on deep dark hero surface (#0a0a0f) passes AA (>= 4.5:1)
    const darkHeroPass = evaluateContrastEntry({
      selector: 'h1.name.clip',
      foregroundColor: 'rgba(0, 0, 0, 0)',
      gradientColors: ['#bd34fe', '#41d1ff'],
      backgroundLayers: ['rgb(10, 10, 15)'],
      inShadowDom: false,
    });
    expect(darkHeroPass).toBeNull();

    // On mid-dark slate (#0f172a), #bd34fe drops to ~4.29:1 (< 4.5:1) and is flagged as the worst-case stop
    const midDarkFail = evaluateContrastEntry({
      selector: 'h1.name.clip',
      foregroundColor: 'rgba(0, 0, 0, 0)',
      gradientColors: ['#bd34fe', '#41d1ff'],
      backgroundLayers: ['rgb(15, 23, 42)'],
      inShadowDom: false,
    });
    expect(midDarkFail).not.toBeNull();
    expect(midDarkFail?.foregroundRgb).toBe('rgb(189, 52, 254)');
    expect(midDarkFail?.contrastRatio).toBeLessThan(MIN_WCAG_AA_CONTRAST);

    // On white backdrop (#ffffff), bright cyan (#41d1ff) has the lowest contrast and is flagged
    const lightHeroFail = evaluateContrastEntry({
      selector: 'h1.name.clip',
      foregroundColor: 'rgba(0, 0, 0, 0)',
      gradientColors: ['#bd34fe', '#41d1ff'],
      backgroundLayers: ['rgb(255, 255, 255)'],
      inShadowDom: false,
    });
    expect(lightHeroFail).not.toBeNull();
    expect(lightHeroFail?.foregroundRgb).toBe('rgb(65, 209, 255)');
    expect(lightHeroFail?.backgroundRgb).toBe('rgb(255, 255, 255)');
    expect(lightHeroFail?.contrastRatio).toBeLessThan(MIN_WCAG_AA_CONTRAST);
  });

  it('==> Should resolve Shadow DOM <button> background across flattened <slot> projections for both text nodes and slotted elements', async () => {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; background: rgb(1, 4, 9); }
            ag-button { color: rgb(255, 255, 255); }
            ag-button span { color: rgb(255, 255, 255); }
            ag-button[variant="inverse"] { color: rgb(15, 23, 42); }
            ag-button[variant="inverse"] span { color: rgb(15, 23, 42); }
          </style>
        </head>
        <body>
          <ag-button variant="primary"><span>Primary Action</span></ag-button>
          <ag-button variant="inverse"><span>Light Pill Action</span></ag-button>
          <script>
            class AgButton extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                const variant = this.getAttribute('variant');
                const bg = variant === 'inverse' ? 'rgb(241, 245, 249)' : 'rgb(37, 99, 235)';
                shadow.innerHTML =
                  '<button style="background: ' + bg + '; border: 0; padding: 8px 16px;">' +
                    '<slot></slot>' +
                  '</button>';
              }
            }
            customElements.define('ag-button', AgButton);
          </script>
        </body>
      </html>
    `);

    const violations = await auditPageContrast(page, MIN_WCAG_AA_CONTRAST);
    await context.close();

    // Without flattened assignedSlot traversal, `ag-button[variant="inverse"] > span`
    // would have resolved against `body` (rgb(1, 4, 9)) instead of the Shadow DOM <button> (rgb(241, 245, 249))!
    expect(violations).toEqual([]);
  });

});
