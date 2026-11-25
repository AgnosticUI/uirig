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
        const matchFn = new Function('el', 'selectors', 'excludeSelectors', fnBody) as (
          el: Element,
          selectors?: string[],
          excludeSelectors?: string[]
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

  it('carves out --exclude subtrees inside --scope and across Light + Shadow DOM (Issue #58)', async () => {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    const page = await browser.newPage();
    await page.setContent(`
      <header id="shell-nav"><a href="/">Nav</a></header>
      <main id="uirig-stage">
        <h3 class="demo-title">Demo Heading</h3>
        <ag-card id="card-1"><p>Card content</p></ag-card>
      </main>
      <script>
        const card = document.getElementById('card-1');
        const sr = card.attachShadow({ mode: 'open' });
        sr.innerHTML = '<div class="card-body"><span class="internal-skip">Skip</span><button>OK</button></div>';
      </script>
    `);

    const res = await page.evaluate(
      ({ fnSrc }) => {
        const checkScope = new Function(`return (${fnSrc});`)() as (
          el: Element,
          include?: string[],
          exclude?: string[]
        ) => boolean;

        const shellNav = document.querySelector('#shell-nav a')!;
        const demoTitle = document.querySelector('.demo-title')!;
        const cardBtn = document.querySelector('#card-1')!.shadowRoot!.querySelector('button')!;
        const internalSkip = document
          .querySelector('#card-1')!
          .shadowRoot!.querySelector('.internal-skip')!;

        return {
          shellNavInScope: checkScope(shellNav, ['#uirig-stage'], ['h3.demo-title']),
          demoTitleInScope: checkScope(demoTitle, ['#uirig-stage'], ['h3.demo-title']),
          cardBtnInScope: checkScope(
            cardBtn,
            ['#uirig-stage'],
            ['h3.demo-title', '.internal-skip']
          ),
          internalSkipInScope: checkScope(
            internalSkip,
            ['#uirig-stage'],
            ['h3.demo-title', '.internal-skip']
          ),
          demoTitleWhenOnlyExclude: checkScope(demoTitle, undefined, ['h3.demo-title']),
          cardBtnWhenOnlyExclude: checkScope(cardBtn, undefined, ['h3.demo-title']),
        };
      },
      { fnSrc: isElementInSelectorScope.toString() }
    );

    expect(res.shellNavInScope).toBe(false);
    expect(res.demoTitleInScope).toBe(false);
    expect(res.cardBtnInScope).toBe(true);
    expect(res.internalSkipInScope).toBe(false);
    expect(res.demoTitleWhenOnlyExclude).toBe(false);
    expect(res.cardBtnWhenOnlyExclude).toBe(true);
  });

});
