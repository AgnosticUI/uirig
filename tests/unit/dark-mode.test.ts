/**
 * tests/unit/dark-mode.test.ts
 * 1-to-1 unit & live Chromium specs for `src/core/dark-mode.ts`.
 * Verifies:
 * 1. Pure `evaluateDarkModeSurfaceEntry` luminance math and minimum surface size filtering.
 * 2. Live Chromium dark-mode emulation (`prefers-color-scheme: dark`, `[data-theme="dark"]`, and `.dark`):
 *    - Coexistence of VitePress `html.dark` page backgrounds and AgnosticUI `[data-theme="dark"]` tokens.
 *    - Clean restoration of original `<html>` `data-theme` and `.dark` state after audit.
 *    - Catches `stranded_light_surface`, `dark_mode_contrast_drop`, and `opacity < 1` Web Component drops.
 *    - Respects `data-uirig-ignore="dark-mode"` and `--selectors` subtree scoping.
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
    expect(
      evaluateDarkModeSurfaceEntry({
        selector: 'div.dark-card',
        backgroundLayers: ['rgb(15, 23, 42)'],
        width: 320,
        height: 180,
        inShadowDom: false,
      })
    ).toBeNull();

    expect(
      evaluateDarkModeSurfaceEntry({
        selector: 'span.white-pill',
        backgroundLayers: ['rgb(255, 255, 255)'],
        width: 90,
        height: 28,
        inShadowDom: false,
      })
    ).toBeNull();

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

  it('activates both .dark (VitePress) and [data-theme="dark"] (AgnosticUI) and restores original <html> state', async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html data-theme="light">
        <head>
          <style>
            html { --vp-c-bg: #ffffff; --vp-c-text: #0f172a; }
            html.dark { --vp-c-bg: #1b1b1f; --vp-c-text: #dfdfd6; }
            :root { --ag-btn-bg: #2563eb; --ag-btn-fg: #ffffff; }
            :root[data-theme="dark"] { --ag-btn-bg: #1d4ed8; --ag-btn-fg: #f8fafc; }
            body { margin: 0; padding: 24px; background: var(--vp-c-bg); color: var(--vp-c-text); }
          </style>
        </head>
        <body>
          <h1>VitePress + AgnosticUI Docs</h1>
          <ag-button>Primary Action</ag-button>
          <script>
            class AgButton extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.innerHTML =
                  '<button style="background: var(--ag-btn-bg); color: var(--ag-btn-fg); border: 0; padding: 8px 16px;">' +
                    'Primary Action' +
                  '</button>';
              }
            }
            customElements.define('ag-button', AgButton);
          </script>
        </body>
      </html>
    `);

    const violations = await runDarkModeAudit(page);
    expect(violations).toEqual([]);

    const restoredState = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      hasDarkClass: document.documentElement.classList.contains('dark'),
    }));
    await context.close();

    expect(restoredState).toEqual({
      dataTheme: 'light',
      hasDarkClass: false,
    });
  });

    it('catches stranded light surfaces, dark-mode contrast drops, and low-opacity Web Components', async () => {
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
            p.hardcoded-dark-text { color: #1e293b; font-size: 16px; }
            .exempt-preview { width: 240px; height: 100px; background: #ffffff; color: #0f172a; }
            ag-faded-btn { display: inline-block; opacity: 0.5; }
          </style>
        </head>
        <body>
          <p class="hardcoded-dark-text">Unreadable dark text in dark mode</p>
          <div class="exempt-preview" data-uirig-ignore="dark-mode">Light theme swatch</div>
          <hardcoded-card></hardcoded-card>
          <ag-faded-btn>Faded</ag-faded-btn>
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

            class AgFadedBtn extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.innerHTML =
                  '<button style="background: #2563eb; color: #ffffff; border: 0; padding: 8px 16px;">' +
                    'Faded' +
                  '</button>';
              }
            }
            customElements.define('ag-faded-btn', AgFadedBtn);
          </script>
        </body>
      </html>
    `);

    const violations = await runDarkModeAudit(page);
    await context.close();

    const contrastDrop = violations.find((v) => v.violationType === 'dark_mode_contrast_drop');
    expect(contrastDrop).toBeDefined();
    expect(contrastDrop?.selector).toBe('p.hardcoded-dark-text');

    const fadedBtnDrop = violations.find(
      (v) => v.violationType === 'dark_mode_contrast_drop' && v.hostComponent === 'ag-faded-btn'
    );
    expect(fadedBtnDrop).toBeDefined();
    expect(fadedBtnDrop?.inShadowDom).toBe(true);

    const strandedCard = violations.find((v) => v.violationType === 'stranded_light_surface');
    expect(strandedCard).toBeDefined();
    expect(strandedCard?.inShadowDom).toBe(true);
    expect(strandedCard?.hostComponent).toBe('hardcoded-card');

    expect(violations.some((v) => v.selector.includes('exempt-preview'))).toBe(false);
  });

  it('restricts dark-mode violations to --selectors subtrees when selectors are provided', async () => {
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
            #off-scope-white { width: 260px; height: 100px; background: #ffffff; color: #0f172a; }
            #scoped-region .scoped-white { width: 260px; height: 100px; background: #ffffff; color: #0f172a; }
          </style>
        </head>
        <body>
          <div id="off-scope-white">Off-scope stranded white box</div>
          <section id="scoped-region">
            <div class="scoped-white">Scoped stranded white box</div>
          </section>
        </body>
      </html>
    `);

    const violations = await runDarkModeAudit(page, { selectors: ['#scoped-region'] });
    await context.close();

    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe('div.scoped-white');
  });
});
