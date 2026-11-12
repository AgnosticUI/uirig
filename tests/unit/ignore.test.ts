/**
 * tests/unit/ignore.test.ts
 * 1-to-1 unit & browser-context specs for `src/utils/ignore.ts`.
 * Verifies:
 * 1. `data-uirig-ignore` attribute parsing (`all`, `*`, comma/space-separated rule lists).
 * 2. Config `ignore` rule matching by `rule`, `selector`, and `url` (including wildcards).
 * 3. Live Chromium Shadow DOM traversal: `data-uirig-ignore` on a Light DOM host or ancestor
 *    exempts elements inside an open `ShadowRoot`, and `closest(selector)` matches across boundaries.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  matchesIgnoreAttributeValue,
  matchesIgnoreUrl,
  isSelectorIgnoredByConfig,
  isElementIgnoredInBrowser,
  type IUirigIgnoreRule,
} from '../../src/utils/ignore.js';

describe('ignore.ts — Runtime-Native Rule Escape Hatches', () => {
  let browser: Browser | undefined;

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('matches data-uirig-ignore attribute tokens for specific rules, comma lists, and "all"', () => {
    console.log('\n--- START TEST: data-uirig-ignore Attribute Token Matching ---');
    expect(matchesIgnoreAttributeValue('tokens', 'tokens')).toBe(true);
    expect(matchesIgnoreAttributeValue('tokens, contrast', 'contrast')).toBe(true);
    expect(matchesIgnoreAttributeValue('stress dom', 'dom')).toBe(true);
    expect(matchesIgnoreAttributeValue('all', 'dark-mode')).toBe(true);
    expect(matchesIgnoreAttributeValue('*', 'cls')).toBe(true);
    expect(matchesIgnoreAttributeValue('tokens', 'contrast')).toBe(false);
    expect(matchesIgnoreAttributeValue(null, 'tokens')).toBe(false);
  });

  it('matches config ignore rules across rule names, selectors, and URL wildcards', () => {
    console.log('\n--- START TEST: Config Ignore Rule Matching ---');
    const rules: IUirigIgnoreRule[] = [
      { rule: 'tokens', selector: '.legacy-embed' },
      { rule: 'contrast', url: 'http://localhost:5173/admin/*' },
      { rule: 'all', selector: '#third-party-chat', url: 'http://localhost:5173' },
    ];

    expect(
      isSelectorIgnoredByConfig(
        'div.legacy-embed > span.badge',
        'tokens',
        'http://localhost:5173',
        rules
      )
    ).toBe(true);

    expect(
      isSelectorIgnoredByConfig(
        'div.legacy-embed > span.badge',
        'contrast',
        'http://localhost:5173',
        rules
      )
    ).toBe(false);

    expect(
      isSelectorIgnoredByConfig(
        'p.muted',
        'contrast',
        'http://localhost:5173/admin/users',
        rules
      )
    ).toBe(true);

    expect(
      isSelectorIgnoredByConfig(
        '#third-party-chat >> shadow-root >> button',
        'dom',
        'http://localhost:5173',
        rules
      )
    ).toBe(true);
  });

  it('walks across open Shadow DOM boundaries in Chromium for both data-uirig-ignore and config rules', async () => {
    console.log('\n--- START TEST: Live Chromium Shadow DOM Ignore Traversal ---');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <section data-uirig-ignore="tokens, dark-mode">
            <custom-widget id="ignored-host"></custom-widget>
          </section>
          <div class="legacy-banner">
            <custom-widget id="config-ignored-host"></custom-widget>
          </div>
          <custom-widget id="active-host"></custom-widget>
          <script>
            class CustomWidget extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.innerHTML = '<button class="inner-btn">Action</button>';
              }
            }
            customElements.define('custom-widget', CustomWidget);
          </script>
        </body>
      </html>
    `);

    const evalResults = await page.evaluate((fnBody) => {
      const checkIgnore = new Function('return ' + fnBody)() as typeof isElementIgnoredInBrowser;
      const rules: IUirigIgnoreRule[] = [{ rule: 'contrast', selector: '.legacy-banner' }];

      const ignoredBtn = document
        .querySelector('#ignored-host')
        ?.shadowRoot?.querySelector('.inner-btn') as Element;
      const configBtn = document
        .querySelector('#config-ignored-host')
        ?.shadowRoot?.querySelector('.inner-btn') as Element;
      const activeBtn = document
        .querySelector('#active-host')
        ?.shadowRoot?.querySelector('.inner-btn') as Element;

      return {
        ignoredTokens: checkIgnore(ignoredBtn, 'tokens', 'http://localhost:5173', rules),
        ignoredStress: checkIgnore(ignoredBtn, 'stress', 'http://localhost:5173', rules),
        configContrast: checkIgnore(configBtn, 'contrast', 'http://localhost:5173', rules),
        activeTokens: checkIgnore(activeBtn, 'tokens', 'http://localhost:5173', rules),
      };
    }, isElementIgnoredInBrowser.toString());

    await context.close();

    expect(evalResults.ignoredTokens).toBe(true);
    expect(evalResults.ignoredStress).toBe(false);
    expect(evalResults.configContrast).toBe(true);
    expect(evalResults.activeTokens).toBe(false);
  });
});
