/**
 * tests/unit/adversary.test.ts
 * Focused unit specs verifying parent-child bounding box overflow, horizontal
 * scrollbar leak detection, and interactive touch-target spacing invariants.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  checkParentChildOverflow,
  checkHorizontalScrollbarLeak,
  checkTouchTargetSpacing,
  runGeometricStressAudit,
  type IBoundingBox,
} from '../../src/core/adversary.js';

describe('::: PHASE 3 TASK 3.3 (CHUNK 1): GEOMETRIC INVARIANT MATH GATES :::', () => {
  const parentCard: IBoundingBox = {
    selector: 'div.pricing-card',
    x: 20,
    y: 40,
    width: 300,
    height: 200,
    inShadowDom: false,
  };

  it('==> Should allow sub-pixel child overflow within overflowPixelTolerance (2px)', () => {
    console.log('\n--- START TEST: Sub-Pixel Rounding Tolerance Pass ---');

    // Child extends 1.5px past parent's right edge (321.5 vs 320) -> inside 2px tolerance
    const subPixelChild: IBoundingBox = {
      selector: 'span.price-label',
      x: 40,
      y: 60,
      width: 281.5,
      height: 30,
      inShadowDom: false,
    };

    const result = checkParentChildOverflow(parentCard, subPixelChild, 2);
    console.log(`[+] Sub-pixel rounding check (expected null): ${result}`);
    expect(result).toBeNull();
  });

  it('==> Should flag child container overflow exceeding overflowPixelTolerance', () => {
    console.log('\n--- START TEST: Parent-Child Container Breach Detection ---');

    // Child spills 28px past parent's right edge (348 vs 320) -> exceeds 2px tolerance
    const overflowingChild: IBoundingBox = {
      selector: 'uirig-badge >> shadow-root >> span.expanded-text',
      x: 40,
      y: 60,
      width: 308,
      height: 30,
      inShadowDom: true,
    };

    const result = checkParentChildOverflow(parentCard, overflowingChild, 2);
    console.log('[!] Container overflow violation caught:', JSON.stringify(result, null, 2));

    expect(result).toEqual({
      violationType: 'container_overflow',
      selector: 'uirig-badge >> shadow-root >> span.expanded-text',
      relatedSelector: 'div.pricing-card',
      measuredLeakPixels: 28,
      inShadowDom: true,
    });
  });

  it('==> Should pass when document scrollWidth matches viewport innerWidth', () => {
    console.log('\n--- START TEST: Clean Mobile Viewport Width Pass ---');

    const result = checkHorizontalScrollbarLeak(375, 375, 2);
    console.log(`[+] Clean mobile viewport check (expected null): ${result}`);
    expect(result).toBeNull();
  });

  it('==> Should flag horizontal scrollbar leak when scrollWidth exceeds innerWidth', () => {
    console.log('\n--- START TEST: Horizontal Scrollbar Bleed Detection ---');

    // 412px document width inside a 375px mobile viewport -> 37px horizontal leak
    const result = checkHorizontalScrollbarLeak(412, 375, 2);
    console.log('[!] Horizontal scrollbar violation caught:', JSON.stringify(result, null, 2));

    expect(result).toEqual({
      violationType: 'horizontal_scrollbar',
      selector: 'document.documentElement',
      measuredLeakPixels: 37,
      inShadowDom: false,
    });
  });

  it('==> Should pass interactive controls separated by at least touchTargetMinSpacingPx', () => {
    console.log('\n--- START TEST: Safe Interactive Target Clearance Pass ---');

    const saveButton: IBoundingBox = {
      selector: 'button#save-btn',
      x: 20,
      y: 100,
      width: 100,
      height: 40,
      inShadowDom: false,
    };

    // Placed 28px to the right (x = 148 vs saveButton right = 120) -> >= 24px budget
    const cancelButton: IBoundingBox = {
      selector: 'button#cancel-btn',
      x: 148,
      y: 100,
      width: 100,
      height: 40,
      inShadowDom: false,
    };

    const result = checkTouchTargetSpacing(saveButton, cancelButton, 24);
    console.log(`[+] Well-spaced buttons check (expected null): ${result}`);
    expect(result).toBeNull();
  });

  it('==> Should flag crowded interactive controls closer than touchTargetMinSpacingPx', () => {
    console.log('\n--- START TEST: Crowded Touch Target Collision Detection ---');

    const saveButton: IBoundingBox = {
      selector: 'button#save-btn',
      x: 20,
      y: 100,
      width: 100,
      height: 40,
      inShadowDom: false,
    };

    // Placed only 8px to the right (x = 128 vs 120 -> 16px short of 24px budget)
    const deleteButton: IBoundingBox = {
      selector: 'button#delete-btn',
      x: 128,
      y: 100,
      width: 100,
      height: 40,
      inShadowDom: false,
    };

    const result = checkTouchTargetSpacing(saveButton, deleteButton, 24);
    console.log('[!] Crowded touch target violation caught:', JSON.stringify(result, null, 2));

    expect(result).toEqual({
      violationType: 'touch_target_collision',
      selector: 'button#save-btn',
      relatedSelector: 'button#delete-btn',
      measuredLeakPixels: 16,
      inShadowDom: false,
    });
  });

  describe('::: PHASE 3 TASK 3.3 (CHUNK 2): LIVE CHROMIUM TEXT-EXPANSION STRESS RIG :::', () => {
    let browser: Browser | undefined;

    afterAll(async () => {
      if (browser) {
        await browser.close();
        console.log('[+] Headless Chromium instance closed cleanly.');
      }
    });

    it('==> Should catch container overflow and horizontal scrollbar bleed after +30% text expansion', async () => {
      console.log('\n--- START TEST: Live Chromium +30% Text Expansion Overflow Rig ---');

      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await context.newPage();

      // Render a fixed-width card (140px) with `white-space: nowrap` text that fits in English
      // but spills past its parent card and causes a horizontal scrollbar when expanded +30%
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 16px; font-family: sans-serif; }
              .rigid-card {
                width: 140px;
                border: 1px solid #cbd5e1;
                padding: 8px;
              }
              .nowrap-label {
                display: inline-block;
                white-space: nowrap;
                font-size: 16px;
              }
            </style>
          </head>
          <body>
            <div class="rigid-card">
              <span class="nowrap-label">Subscription Plan Settings</span>
            </div>
          </body>
        </html>
      `);

      const violations = await runGeometricStressAudit(page, {
        overflowPixelTolerance: 2,
        touchTargetMinSpacingPx: 24,
      });
      console.log('[!] Live stress violations caught:', JSON.stringify(violations, null, 2));

      await context.close();

      const overflowViolation = violations.find(
        (v) => v.violationType === 'container_overflow' && v.selector === 'span.nowrap-label'
      );
      expect(overflowViolation).toBeDefined();
      expect(overflowViolation?.relatedSelector).toBe('div.rigid-card');
      expect(overflowViolation?.measuredLeakPixels).toBeGreaterThan(2);
    });

    it('==> Should catch touch target crowding inside an open ShadowRoot when buttons expand', async () => {
      console.log('\n--- START TEST: Shadow DOM Interactive Touch Target Crowding ---');

      if (!browser) {
        browser = await chromium.launch({ headless: true });
      }
      const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
      const page = await context.newPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>body { margin: 0; padding: 24px; }</style>
          </head>
          <body>
            <uirig-toolbar></uirig-toolbar>
            <script>
              class UirigToolbar extends HTMLElement {
                constructor() {
                  super();
                  const shadow = this.attachShadow({ mode: 'open' });
                  shadow.innerHTML =
                    '<div style="display: flex; gap: 6px; width: 600px;">' +
                      '<button id="btn-approve">Approve</button>' +
                      '<button id="btn-reject">Reject</button>' +
                    '</div>';
                }
              }
              customElements.define('uirig-toolbar', UirigToolbar);
            </script>
          </body>
        </html>
      `);

      const violations = await runGeometricStressAudit(page, {
        overflowPixelTolerance: 2,
        touchTargetMinSpacingPx: 24,
      });
      console.log('[!] Shadow DOM touch target violations:', JSON.stringify(violations, null, 2));

      await context.close();

      const collision = violations.find((v) => v.violationType === 'touch_target_collision');
      expect(collision).toBeDefined();
      expect(collision?.inShadowDom).toBe(true);
      expect(collision?.selector).toBe('uirig-toolbar >> shadow-root >> button#btn-approve');
      expect(collision?.relatedSelector).toBe('uirig-toolbar >> shadow-root >> button#btn-reject');
    });
  });

});
