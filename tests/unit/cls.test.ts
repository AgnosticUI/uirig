/**
 * tests/unit/cls.test.ts
 * Focused unit specs verifying Google's W3C CLS session-window grouping,
 * user-input (`hadRecentInput`) exclusion, and `clsMaxLimit` budget thresholds.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  evaluateClsSamples,
  DEFAULT_CLS_MAX_LIMIT,
  prepareClsObserver,
  collectPageCls,
  type ILayoutShiftSample,
} from '../../src/core/cls.js';

describe('::: PHASE 3 TASK 3.4 (CHUNK 1): CLS SESSION WINDOW MATH GATES :::', () => {
  it('==> Should pass with 0 CLS when no unexpected shifts occur', () => {
    console.log('\n--- START TEST: Zero Layout Shift Baseline ---');

    const result = evaluateClsSamples([], DEFAULT_CLS_MAX_LIMIT);
    console.log(`[+] Empty samples CLS score: ${result.maxSessionCls}`);

    expect(result.maxSessionCls).toBe(0);
    expect(result.violation).toBeNull();
  });

  it('==> Should ignore shifts caused by recent user input (hadRecentInput: true)', () => {
    console.log('\n--- START TEST: User-Input Shift Exclusion Filter ---');

    const userTriggeredShifts: ILayoutShiftSample[] = [
      {
        value: 0.35,
        startTime: 120,
        hadRecentInput: true,
        affectedSelectors: ['div.accordion-panel'],
      },
    ];

    const result = evaluateClsSamples(userTriggeredShifts, DEFAULT_CLS_MAX_LIMIT);
    console.log(`[+] User-triggered shift CLS score (expected 0): ${result.maxSessionCls}`);

    expect(result.maxSessionCls).toBe(0);
    expect(result.violation).toBeNull();
  });

  it('==> Should split shifts separated by >= 1000ms into separate session windows', () => {
    console.log('\n--- START TEST: 1-Second Session Window Gap Split ---');

    // Two small shifts of 0.06 each separated by 1,500ms:
    // Naive sum would be 0.12 (FAIL), but separate session windows each score 0.06 (PASS!)
    const separatedShifts: ILayoutShiftSample[] = [
      {
        value: 0.06,
        startTime: 200,
        hadRecentInput: false,
        affectedSelectors: ['header.top-nav'],
      },
      {
        value: 0.06,
        startTime: 1700,
        hadRecentInput: false,
        affectedSelectors: ['footer.site-footer'],
      },
    ];

    const result = evaluateClsSamples(separatedShifts, DEFAULT_CLS_MAX_LIMIT);
    console.log(`[+] Separated windows max CLS score (expected 0.06): ${result.maxSessionCls}`);

    expect(result.maxSessionCls).toBe(0.06);
    expect(result.violation).toBeNull();
  });

  it('==> Should cap a single session window at 5000ms total duration', () => {
    console.log('\n--- START TEST: 5-Second Max Window Duration Cap ---');

    // Rapid shifts every 800ms:
    // Window 1 (t=0, 800, 1600, 2400, 3200, 4000, 4800 -> 7 * 0.01 = 0.07)
    // At t=5600, duration from t=0 is 5600ms >= 5000ms -> starts Window 2 (0.04)
    const rapidStream: ILayoutShiftSample[] = [0, 800, 1600, 2400, 3200, 4000, 4800].map((t) => ({
      value: 0.01,
      startTime: t,
      hadRecentInput: false,
      affectedSelectors: ['main.feed'],
    }));
    rapidStream.push({
      value: 0.04,
      startTime: 5600,
      hadRecentInput: false,
      affectedSelectors: ['aside.promo'],
    });

    const result = evaluateClsSamples(rapidStream, DEFAULT_CLS_MAX_LIMIT);
    console.log(`[+] 5s-capped max session CLS score (expected 0.07): ${result.maxSessionCls}`);

    expect(result.maxSessionCls).toBe(0.07);
    expect(result.violation).toBeNull();
  });

  it('==> Should flag an IClsViolation when a session window exceeds clsMaxLimit (0.1)', () => {
    console.log('\n--- START TEST: CLS Budget Breach Violation Detection ---');

    // Two shifts 300ms apart inside the same window: 0.08 + 0.14 = 0.22 > 0.1 -> FAIL
    const unstableShifts: ILayoutShiftSample[] = [
      {
        value: 0.08,
        startTime: 150,
        hadRecentInput: false,
        affectedSelectors: ['div.late-banner'],
      },
      {
        value: 0.14,
        startTime: 450,
        hadRecentInput: false,
        affectedSelectors: ['uirig-hero >> shadow-root >> section.content'],
      },
    ];

    const result = evaluateClsSamples(unstableShifts, DEFAULT_CLS_MAX_LIMIT);
    console.log('[!] CLS violation caught:', JSON.stringify(result.violation, null, 2));

    expect(result.maxSessionCls).toBe(0.22);
    expect(result.violation).toEqual({
      measuredClsScore: 0.22,
      clsMaxLimit: 0.1,
      shiftCountInWorstWindow: 2,
      offendingSelectors: ['div.late-banner', 'uirig-hero >> shadow-root >> section.content'],
    });
  });
});

describe('::: PHASE 3 TASK 3.4 (CHUNK 2): LIVE CHROMIUM CLS PERFORMANCE OBSERVER :::', () => {
  let browser: Browser | undefined;

  afterAll(async () => {
    if (browser) {
      await browser.close();
      console.log('[+] Headless Chromium instance closed cleanly.');
    }
  });

  it('==> Should report 0 CLS on a visually stable page with reserved layout dimensions', async () => {
    console.log('\n--- START TEST: Stable Layout Zero-CLS Verification ---');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();

    // Register observer BEFORE loading content
    await prepareClsObserver(page);

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 24px; font-family: sans-serif; }
            .reserved-slot { height: 120px; background: #e2e8f0; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="reserved-slot">Reserved Hero Slot</div>
          <main class="main-article">Stable content that never shifts position.</main>
        </body>
      </html>
    `);

    const result = await collectPageCls(page, DEFAULT_CLS_MAX_LIMIT, 150);
    console.log(`[+] Stable page CLS score: ${result.maxSessionCls}`);

    await context.close();

    expect(result.maxSessionCls).toBe(0);
    expect(result.violation).toBeNull();
  });

  it('==> Should catch late-injected DOM banner layout shifts and attribute offending selectors', async () => {
    console.log('\n--- START TEST: Late Banner Injection CLS Breach Detection ---');

    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();

    // Register observer BEFORE loading content
    await prepareClsObserver(page);

    // Render content at the top of the viewport, wait for Frame 1 to paint,
    // then dynamically prepend a 240px banner to push `.primary-content` downward
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; font-family: sans-serif; }
            .primary-content {
              height: 300px;
              background: #f8fafc;
              padding: 24px;
            }
          </style>
        </head>
        <body>
          <main class="primary-content">Primary article pushed down by late banner</main>
          <script>
            requestAnimationFrame(() => {
              setTimeout(() => {
                const banner = document.createElement('div');
                banner.className = 'async-promo-banner';
                banner.style.height = '240px';
                banner.style.background = '#fee2e2';
                banner.textContent = 'Late Async Promo Banner';
                document.body.insertBefore(banner, document.body.firstChild);
              }, 80);
            });
          </script>
        </body>
      </html>
    `);

    const result = await collectPageCls(page, DEFAULT_CLS_MAX_LIMIT, 300);
    console.log('[!] Live Chromium CLS violation caught:', JSON.stringify(result, null, 2));

    await context.close();

    expect(result.maxSessionCls).toBeGreaterThan(DEFAULT_CLS_MAX_LIMIT);
    expect(result.violation).not.toBeNull();
    expect(result.violation?.shiftCountInWorstWindow).toBeGreaterThanOrEqual(1);
    expect(result.violation?.offendingSelectors).toContain('main.primary-content');
  });
 
});
