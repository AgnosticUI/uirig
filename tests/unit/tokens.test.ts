/**
 * tests/unit/tokens.test.ts
 * Unit tests observing how validateComputedStyleEntry and crawlPageTokens catch
 * unauthorized colors, magic pixel spacing, and Shadow DOM drift while passing compliant elements.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  validateComputedStyleEntry,
  extractShadowPiercingStyles,
  crawlPageTokens,
  type ITokenScaleConfig,
  type IExtractedElementStyles,
} from '../../src/core/tokens.js';

describe('::: PHASE 3 TASK 3.1 (CHUNK 2): TOKEN VALIDATION LOGIC GATES :::', () => {
  // Define a strict baseline design system scale for testing
  const approvedScale: ITokenScaleConfig = {
    colors: ['rgb(15, 23, 42)', 'rgb(255, 255, 255)', 'rgb(59, 130, 246)'],
    spacing: ['0px', '8px', '16px', '24px'],
    fontSizes: ['14px', '16px', '24px'],
    radii: ['0px', '4px', '8px'],
  };

  it('==> Should pass an element whose computed styles strictly match the approved token scale', () => {
    console.log('\n--- START TEST: Compliant Element Token Audit ---');

    // Simulate a button styled exclusively with approved design tokens and a transparent wrapper default
    const compliantElement: IExtractedElementStyles = {
      selector: 'button.primary-btn',
      inShadowDom: false,
      styles: {
        color: 'rgb(255, 255, 255)',
        backgroundColor: 'rgb(59, 130, 246)',
        paddingTop: '8px',
        paddingBottom: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        fontSize: '14px',
        borderRadius: '4px',
      },
    };

    console.log(`[+] Auditing selector: ${compliantElement.selector}`);
    const violations = validateComputedStyleEntry(compliantElement, approvedScale);
    console.log(`[+] Violations detected: ${violations.length}`);

    expect(violations).toHaveLength(0);
  });

  it('==> Should ignore transparent background defaults without throwing false positives', () => {
    console.log('\n--- START TEST: Transparent Background Noise Filter ---');

    const transparentWrapper: IExtractedElementStyles = {
      selector: 'div.layout-container',
      inShadowDom: false,
      styles: {
        color: 'rgb(15, 23, 42)',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        paddingTop: '0px',
        paddingBottom: '0px',
        paddingLeft: '0px',
        paddingRight: '0px',
        fontSize: '16px',
        borderRadius: '0px',
      },
    };

    const violations = validateComputedStyleEntry(transparentWrapper, approvedScale);
    console.log(`[+] Violations on transparent wrapper: ${violations.length}`);

    expect(violations).toHaveLength(0);
  });

  it('==> Should catch hardcoded hex/rgb colors, magic pixel padding, and Shadow DOM violations', () => {
    console.log('\n--- START TEST: Rogue Magic Number & Shadow DOM Detection ---');

    // Simulate a Web Component element inside a ShadowRoot using rogue values (13px padding, rogue pink color)
    const rogueShadowElement: IExtractedElementStyles = {
      selector: 'my-card >> shadow-root >> span.badge',
      inShadowDom: true,
      styles: {
        color: 'rgb(255, 0, 128)',       // Rogue hardcoded color
        backgroundColor: 'rgba(0, 0, 0, 0)',
        paddingTop: '13px',              // Rogue magic pixel spacing
        paddingBottom: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        fontSize: '15px',                // Rogue off-scale font size
        borderRadius: '4px',
      },
    };

    console.log(`[+] Auditing Shadow DOM element: ${rogueShadowElement.selector}`);
    const violations = validateComputedStyleEntry(rogueShadowElement, approvedScale);
    console.log('[!] Violations caught:', JSON.stringify(violations, null, 2));

    expect(violations).toEqual([
      {
        selector: 'my-card >> shadow-root >> span.badge',
        property: 'color',
        actualValue: 'rgb(255, 0, 128)',
        inShadowDom: true,
      },
      {
        selector: 'my-card >> shadow-root >> span.badge',
        property: 'paddingTop',
        actualValue: '13px',
        inShadowDom: true,
      },
      {
        selector: 'my-card >> shadow-root >> span.badge',
        property: 'fontSize',
        actualValue: '15px',
        inShadowDom: true,
      },
    ]);
  });
});
describe('::: PHASE 3 TASK 3.1 (CHUNK 3B & 3C): SHADOW-PIERCING BROWSER CRAWLER :::', () => {
  // Hold a reference to the Chromium browser so we can close it cleanly after tests finish
  let browser: Browser | undefined;

  const approvedScale: ITokenScaleConfig = {
    colors: ['rgb(15, 23, 42)', 'rgb(255, 255, 255)', 'rgb(59, 130, 246)'],
    spacing: ['0px', '8px', '16px', '24px'],
    fontSizes: ['14px', '16px', '24px'],
    radii: ['0px', '4px', '8px'],
  };

  // Ensure the headless browser process never leaks after the test suite completes
  afterAll(async () => {
    if (browser) {
      await browser.close();
      console.log('[+] Headless Chromium instance closed cleanly.');
    }
  });

  it('==> Should launch headless Chromium, extract Light-DOM styles, and ignore hidden elements', async () => {
    console.log('\n--- START TEST: Live Light-DOM Computed Style Extraction ---');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('[+] Injecting Light-DOM HTML fixture into Playwright page...');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              color: rgb(15, 23, 42);
              background-color: rgb(255, 255, 255);
              margin: 0;
              padding: 0;
              font-size: 16px;
            }
            .cta-btn {
              color: rgb(255, 255, 255);
              background-color: rgb(59, 130, 246);
              padding: 8px 16px;
              font-size: 14px;
              border-radius: 4px;
            }
            .hidden-banner {
              display: none;
              color: rgb(255, 0, 128);
            }
          </style>
        </head>
        <body>
          <button class="cta-btn">Deploy</button>
          <div class="hidden-banner">Should be skipped</div>
        </body>
      </html>
    `);

    const extracted = await extractShadowPiercingStyles(page);
    console.log('[+] Extracted snapshots:', JSON.stringify(extracted, null, 2));

    await context.close();

    const selectors = extracted.map((item) => item.selector);
    expect(selectors).toEqual(['body', 'button.cta-btn']);
    expect(selectors).not.toContain('div.hidden-banner');

    const buttonEntry = extracted.find((item) => item.selector === 'button.cta-btn');
    expect(buttonEntry).toBeDefined();
    expect(buttonEntry?.inShadowDom).toBe(false);
    expect(buttonEntry?.styles.color).toBe('rgb(255, 255, 255)');
    expect(buttonEntry?.styles.paddingTop).toBe('8px');
    expect(buttonEntry?.styles.paddingLeft).toBe('16px');
  });

  it('==> Should pierce open ShadowRoot boundaries and flag rogue Web Component styles via crawlPageTokens', async () => {
    console.log('\n--- START TEST: End-to-End Shadow DOM Token Drift Crawl ---');

    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    const context = await browser.newContext();
    const page = await context.newPage();

    // Render a compliant Light-DOM button alongside a custom Web Component (<uirig-card>)
    // containing an open ShadowRoot with rogue color, paddingTop, and fontSize values
    console.log('[+] Rendering page with custom Web Component <uirig-card>...');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              color: rgb(15, 23, 42);
              background-color: rgb(255, 255, 255);
              margin: 0;
              padding: 0;
              font-size: 16px;
            }
            .compliant-btn {
              color: rgb(255, 255, 255);
              background-color: rgb(59, 130, 246);
              padding: 8px 16px;
              font-size: 14px;
              border-radius: 4px;
              border: none;
            }
          </style>
        </head>
        <body>
          <button class="compliant-btn">Compliant Light DOM Button</button>
          <uirig-card></uirig-card>
          <script>
            class UirigCard extends HTMLElement {
              constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.innerHTML =
                  '<style>' +
                    '.rogue-badge {' +
                      'color: rgb(255, 0, 128);' +
                      'padding-top: 13px;' +
                      'padding-bottom: 8px;' +
                      'padding-left: 16px;' +
                      'padding-right: 16px;' +
                      'font-size: 15px;' +
                      'border-radius: 4px;' +
                    '}' +
                  '</style>' +
                  '<span class="rogue-badge">Shadow DOM Drift</span>';
              }
            }
            customElements.define('uirig-card', UirigCard);
          </script>
        </body>
      </html>
    `);

    // Execute the full crawler + validator pipeline against the live page
    const violations = await crawlPageTokens(page, approvedScale);
    console.log('[!] Violations returned by crawlPageTokens:', JSON.stringify(violations, null, 2));

    await context.close();

    // Verify Light DOM nodes produced zero false positives
    const lightDomViolations = violations.filter((v) => !v.inShadowDom);
    expect(lightDomViolations).toHaveLength(0);

    // Verify all 3 rogue styles inside <uirig-card>'s ShadowRoot were caught with exact selectors
    const shadowViolations = violations.filter((v) => v.inShadowDom);
    expect(shadowViolations).toEqual([
      {
        selector: 'uirig-card >> shadow-root >> span.rogue-badge',
        property: 'color',
        actualValue: 'rgb(255, 0, 128)',
        inShadowDom: true,
      },
      {
        selector: 'uirig-card >> shadow-root >> span.rogue-badge',
        property: 'paddingTop',
        actualValue: '13px',
        inShadowDom: true,
      },
      {
        selector: 'uirig-card >> shadow-root >> span.rogue-badge',
        property: 'fontSize',
        actualValue: '15px',
        inShadowDom: true,
      },
    ]);
  });
});
