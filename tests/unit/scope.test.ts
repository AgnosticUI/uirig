/**
 * tests/unit/scope.test.ts
 * 1-to-1 unit tests for `src/utils/scope.ts`.
 * Verifies:
 * 1. `parseSelectorList()` comma splitting, deduplication, and preservation of commas
 *    inside attribute quotes `[data-qux="a, b"]` and `:is(.a, .b)` parentheses.
 * 2. `validateSelectorsInBrowser()` acceptance of valid CSS selectors and `ERR_INVALID_SELECTOR`
 *    rejection of malformed selectors inside Playwright Chromium.
 * 3. `isElementInSelectorScope()` Light DOM ancestor matching and open `ShadowRoot.host`
 *    boundary piercing inside Playwright Chromium.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  parseSelectorList,
  validateSelectorsInBrowser,
  isElementInSelectorScope,
} from '../../src/utils/scope.js';

describe('scope.ts — Component-Scoped Selector Parser & Shadow DOM Matcher', () => {
  let browser: Browser | null = null;

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('parses comma-separated selectors while preserving commas inside brackets and parentheses', () => {
    console.log('\n--- START TEST: Bracket/Paren-Aware Selector Splitting ---');
    const parsed = parseSelectorList(
      `#foo, .bar, [data-qux='yo, buddy'], :is(.card, .panel), #foo`
    );

    expect(parsed).toEqual([
      '#foo',
      '.bar',
      `[data-qux='yo, buddy']`,
      ':is(.card, .panel)',
    ]);
    expect(parseSelectorList('   ,  ')).toEqual([]);
  });

  it('validates CSS selectors in Playwright and throws ERR_INVALID_SELECTOR on malformed input', async () => {
    console.log('\n--- START TEST: Browser CSS Selector Syntax Validation ---');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<div id="app"><button class="btn">Click</button></div>');

    await expect(
      validateSelectorsInBrowser(page, ['#app', '.btn', '[data-test="ok"]'])
    ).resolves.toBeUndefined();

    await expect(validateSelectorsInBrowser(page, ['#app', 'div > > .bad'])).rejects.toThrow(
      'ERR_INVALID_SELECTOR'
    );
  });

  it('matches Light DOM descendants and pierces ShadowRoot.host boundaries in browser DOM', async () => {
    console.log('\n--- START TEST: Shadow-DOM-Aware Subtree Scope Matching ---');
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    const page = await browser.newPage();
    await page.setContent(`
      <header id="global-nav"><a href="/">Home</a></header>
      <main id="target-section">
        <my-widget id="widget-1"></my-widget>
      </main>
      <script>
        const host = document.getElementById('widget-1');
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = '<button id="shadow-btn">Save</button>';
      </script>
    `);

    const results = await page.evaluate(
      ({ fnBody }) => {
        const matchFn = new Function('el', 'selectors', fnBody) as (
          el: Element,
          selectors?: string[]
        ) => boolean;

        const navLink = document.querySelector('#global-nav a')!;
        const widgetHost = document.querySelector('#widget-1')!;
        const shadowBtn = widgetHost.shadowRoot!.querySelector('#shadow-btn')!;

        return {
          navInTarget: matchFn(navLink, ['#target-section']),
          widgetInTarget: matchFn(widgetHost, ['#target-section']),
          shadowBtnInTarget: matchFn(shadowBtn, ['#target-section']),
          shadowBtnInWidgetTag: matchFn(shadowBtn, ['my-widget']),
          navWhenUnscoped: matchFn(navLink, undefined),
        };
      },
      {
        // Extract function body so we test the exact production `isElementInSelectorScope` logic
        fnBody: isElementInSelectorScope
          .toString()
          .replace(/^[^{]*\{/, '')
          .replace(/\}[^}]*$/, ''),
      }
    );

    expect(results.navInTarget).toBe(false);
    expect(results.widgetInTarget).toBe(true);
    expect(results.shadowBtnInTarget).toBe(true);
    expect(results.shadowBtnInWidgetTag).toBe(true);
    expect(results.navWhenUnscoped).toBe(true);
  });
});
