/**
 * tests/unit/dom-walker.test.ts
 * 1-to-1 unit & browser-context specs for `src/utils/dom-walker.ts`.
 * Verifies:
 * 1. Pure Node-side `extractHostComponentFromSelector` across Light DOM, single ShadowRoot,
 *    and nested ShadowRoot breadcrumbs with `#id` / `.class` qualifiers.
 * 2. Live Chromium `createBrowserDomWalker` traversal across nested open ShadowRoots,
 *    verifying `hostComponent`, `inShadowDom`, `selector`, and integrated `isIgnored()` checks.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  extractHostComponentFromSelector,
  createBrowserDomWalker,
  type IWalkedElementMetadata,
} from '../../src/utils/dom-walker.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../../src/utils/ignore.js';

describe('dom-walker.ts — Shared Shadow-Host & Selector Walker', () => {
  let browser: Browser | undefined;

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('extracts hostComponent accurately from Light DOM, single ShadowRoot, and nested ShadowRoot selectors', () => {
    console.log('\n--- START TEST: Selector Breadcrumb Shadow Host Extraction ---');
    expect(extractHostComponentFromSelector('main > section.hero > button.cta')).toBeNull();
    expect(
      extractHostComponentFromSelector('ag-button#submit-btn >> shadow-root >> button.inner')
    ).toBe('ag-button');
    expect(
      extractHostComponentFromSelector(
        'ag-card.pricing >> shadow-root >> ag-badge.promo >> shadow-root >> span.label'
      )
    ).toBe('ag-badge');
  });

  it('traverses Light DOM and nested open ShadowRoots in Chromium with hostComponent and ignore checks', async () => {
    console.log('\n--- START TEST: Live Chromium Nested Shadow DOM Walker ---');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <main class="shell">
            <outer-card id="card-1"></outer-card>
            <div data-uirig-ignore="tokens">
              <span class="exempt-text">Exempt</span>
            </div>
          </main>
          <script>
            class InnerBadge extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.innerHTML = '<span class="badge-label">New</span>';
              }
            }
            customElements.define('inner-badge', InnerBadge);

            class OuterCard extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.innerHTML = '<div class="card-body"><inner-badge></inner-badge></div>';
              }
            }
            customElements.define('outer-card', OuterCard);
          </script>
        </body>
      </html>
    `);

    const walkedItems = await page.evaluate(
      ({
        walkerFactorySrc,
        ignoreHelperSrc,
      }: {
        walkerFactorySrc: string;
        ignoreHelperSrc: string;
      }) => {
        const buildWalker = new Function(
          `return (${walkerFactorySrc});`
        )() as typeof createBrowserDomWalker;
        const rules: IUirigIgnoreRule[] = [];
        const walker = buildWalker('http://localhost:5173', rules, ignoreHelperSrc);

        const collected: Array<IWalkedElementMetadata & { ignoredTokens: boolean }> = [];
        walker.walkElements(
          (el, meta) => {
            collected.push({
              ...meta,
              ignoredTokens: walker.isIgnored(el, 'tokens'),
            });
          },
          { includeBody: false }
        );
        return collected;
      },
      {
        walkerFactorySrc: createBrowserDomWalker.toString(),
        ignoreHelperSrc: isElementIgnoredInBrowser.toString(),
      }
    );

    await context.close();

    const cardBody = walkedItems.find((item) => item.selector.endsWith('div.card-body'));
    expect(cardBody).toEqual({
      selector: 'outer-card#card-1 >> shadow-root >> div.card-body',
      hostComponent: 'outer-card',
      inShadowDom: true,
      ignoredTokens: false,
    });

    const nestedBadgeLabel = walkedItems.find((item) => item.selector.endsWith('span.badge-label'));
    expect(nestedBadgeLabel).toEqual({
      selector: 'outer-card#card-1 >> shadow-root >> inner-badge >> shadow-root >> span.badge-label',
      hostComponent: 'inner-badge',
      inShadowDom: true,
      ignoredTokens: false,
    });

    const exemptSpan = walkedItems.find((item) => item.selector === 'span.exempt-text');
    expect(exemptSpan?.ignoredTokens).toBe(true);
    expect(exemptSpan?.hostComponent).toBeNull();
  });
});
