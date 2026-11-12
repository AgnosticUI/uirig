/**
 * tests/unit/dark-mode.test.ts
 * 1-to-1 unit & live Chromium specs for `src/core/dark-mode.ts`.
 * Verifies:
 * 1. Pure `evaluateDarkModeSurfaceEntry` luminance math and minimum surface size filtering.
 * 2. Live Chromium dark-mode emulation (`prefers-color-scheme: dark` + `[data-theme="dark"]`):
 *    - Passes properly tokenized dark surfaces and high-contrast dark text.
 *    - Catches `stranded_light_surface` (hardcoded `#ffffff` cards) and `dark_mode_contrast_drop`
 *      across both Light DOM and open ShadowRoot Web Components.
 *    - Respects `data-uirig-ignore="dark-mode"`.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  evaluateDarkModeSurfaceEntry,
  runDarkModeAudit,
} from '../../src/core/dark-mode.js';

describe('dark-mode.ts — Theme Parity & Luminance Inversion Gate', () => {
  let browser: Browser | undefined;

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('evaluates surface luminance accurately and ignores small badges <= 120x60px', () => {
    console.log('\n--- START TEST: Pure Dark-Mode Surface Luminance Evaluation ---');

    // Dark slate card (luminance ~ 0.017) -> PASS
    expect(
      evaluateDarkModeSurfaceEntry({
        selector: 'div.dark-card',
        backgroundLayers: ['rgb(15, 23, 42)'],
        width: 320,
        height: 180,
        inShadowDom: false,
      })
    ).toBeNull();

    // Small white pill badge (90x28px) -> skipped by minimum surface dimensions
    expect(
      evaluateDarkModeSurfaceEntry({
        selector: 'span.white-pill',
        backgroundLayers: ['rgb(255, 255, 255)'],
        width: 90,
        height: 28,
        inShadowDom: false,
      })
    ).toBeNull();

    // Large hardcoded white card (320x180px, luminance = 1.0 > 0.85) -> FAIL
    const stranded = evaluateDarkModeSurfaceEntry({
      selector: 'ag-card >> shadow-root >> div.card-shell',
      backgroundLayers: ['rgb(255, 255, 255)'],
      width: 320,
      height: 180,
      inShadowDom: true,
    });

    expect(stranded).toEqual({
      violationType: 'stranded_light_surface',
      selector: 'ag-card >> shadow-root >> div.card-shell',
      hostComponent: 'ag-card',
      backgroundRgb: 'rgb(255, 255, 255)',
      relativeLuminance: 1,
      inShadowDom: true,
    });
  });

  it('passes a page that cleanly adapts surfaces and text to dark mode', async () => {
    console.log('\n--- START TEST: Compliant Dark-Mode Theme Parity Pass ---');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            :root {
              --bg: #ffffff;
              --surface: #f8fafc;
              --fg: #0f172a;
            }
            :root[data-theme="dark"] {
              --bg: #0f172a;
              --surface: #1e293b;
              --fg: #f8fafc;
            }
            body { margin: 0; padding: 24px; background: var(--bg); color: var(--fg); }
            .panel { width: 320px; height: 140px; padding: 16px; background: var(--surface); }
          </style>
        </head>
        <body>
          <div class="panel">
            <h1>Dark Mode Ready</h1>
            <p>Tokenized surface and foreground adapt automatically.</p>
          </div>
        </body>
      </html>
    `);

    const violations = await runDarkModeAudit(page);
    await context.close();

    expect(violations).toEqual([]);
  });

  it('catches stranded light surfaces and dark-mode contrast drops across Light & Shadow DOM', async () => {
    console.log('\n--- START TEST: Stranded Light Surface & Dark Contrast Drop Detection ---');
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
            body { margin: 0; padding: 24px; background: #0f172a; color: #f8fafc; }
            /* Hardcoded dark text that becomes unreadable on dark body */
            p.hardcoded-dark-text { color: #1e293b; font-size: 16px; }
            /* Intentional light preview exempted via data-uirig-ignore */
            .exempt-preview { width: 240px; height: 100px; background: #ffffff; color: #0f172a; }
          </style>
        </head>
        <body>
          <p class="hardcoded-dark-text">Unreadable dark text in dark mode</p>
          <div class="exempt-preview" data-uirig-ignore="dark-mode">Light theme swatch</div>
          <hardcoded-card></hardcoded-card>
          <script>
            class HardcodedCard extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.innerHTML =
                  '<div class="white-box" style="width: 300px; height: 120px; background: #ffffff; color: #0f172a;">' +
                    'Stranded white card inside Shadow DOM' +
                  '</div>';
              }
            }
            customElements.define('hardcoded-card', HardcodedCard);
          </script>
        </body>
      </html>
    `);

    const violations = await runDarkModeAudit(page);
    await context.close();

    const contrastDrop = violations.find((v) => v.violationType === 'dark_mode_contrast_drop');
    expect(contrastDrop).toBeDefined();
    expect(contrastDrop?.selector).toBe('p.hardcoded-dark-text');

    const strandedCard = violations.find((v) => v.violationType === 'stranded_light_surface');
    expect(strandedCard).toBeDefined();
    expect(strandedCard?.inShadowDom).toBe(true);
    expect(strandedCard?.hostComponent).toBe('hardcoded-card');

    // Exempt preview swatch must not appear in violations
    expect(violations.some((v) => v.selector.includes('exempt-preview'))).toBe(false);
  });
});
