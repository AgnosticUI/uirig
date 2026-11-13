/**
 * tests/unit/adversary.test.ts
 * Focused unit & live Chromium specs verifying parent-child bounding box overflow, horizontal
 * scrollbar leak detection, interactive touch-target spacing invariants, and `--selectors` scoping.
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

    const subPixelChild: IBoundingBox = {
      selector: 'span.price-label',
      x: 40,
      y: 60,
      width: 281.5,
      height: 30,
      inShadowDom: false,
    };

    const result = checkParentChildOverflow(parentCard, subPixelChild, 2);
    expect(result).toBeNull();
  });

  it('==> Should flag child container overflow exceeding overflowPixelTolerance', () => {
    console.log('\n--- START TEST: Parent-Child Container Breach Detection ---');

    const overflowingChild: IBoundingBox = {
      selector: 'uirig-badge >> shadow-root >> span.expanded-text',
      x: 40,
      y: 60,
      width: 308,
      height: 30,
      inShadowDom: true,
    };

    const result = checkParentChildOverflow(parentCard, overflowingChild, 2);

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
    expect(checkHorizontalScrollbarLeak(375, 375, 2)).toBeNull();
  });

  it('==> Should flag horizontal scrollbar leak when scrollWidth exceeds innerWidth', () => {
    console.log('\n--- START TEST: Horizontal Scrollbar Bleed Detection ---');

    const result = checkHorizontalScrollbarLeak(412, 375, 2);
    expect(result).toEqual({
      violationType: 'horizontal_scrollbar',
      selector: 'document.documentElement',
      hostComponent: null,
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

    const cancelButton: IBoundingBox = {
      selector: 'button#cancel-btn',
      x: 148,
      y: 100,
      width: 100,
      height: 40,
      inShadowDom: false,
    };

    expect(checkTouchTargetSpacing(saveButton, cancelButton, 24)).toBeNull();
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

    const deleteButton: IBoundingBox = {
      selector: 'button#delete-btn',
      x: 128,
      y: 100,
      width: 100,
      height: 40,
      inShadowDom: false,
    };

    expect(checkTouchTargetSpacing(saveButton, deleteButton, 24)).toEqual({
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

      await context.close();

      const collision = violations.find((v) => v.violationType === 'touch_target_collision');
      expect(collision).toBeDefined();
      expect(collision?.inShadowDom).toBe(true);
      expect(collision?.selector).toBe('uirig-toolbar >> shadow-root >> button#btn-approve');
      expect(collision?.relatedSelector).toBe('uirig-toolbar >> shadow-root >> button#btn-reject');
    });
    it('==> Should exempt inline paragraph links and .sr-only utilities without false positives', async () => {
      console.log('\n--- START TEST: Inline Prose Links & .sr-only False-Positive Exemptions ---');

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
              body { margin: 0; padding: 24px; font-family: sans-serif; font-size: 16px; line-height: 1.5; }
              .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                opacity: 0;
                overflow: hidden;
              }
            </style>
          </head>
          <body>
            <span class="sr-only">Screen reader announcement</span>
            <p>
              Read our <a href="/terms">terms</a> and <a href="/privacy">privacy</a> policies for details.
            </p>
          </body>
        </html>
      `);

      const violations = await runGeometricStressAudit(page, {
        overflowPixelTolerance: 2,
        touchTargetMinSpacingPx: 24,
      });

      await context.close();

      expect(violations).toEqual([]);
    });

    it('==> Should catch undersized touch targets, flex-squished avatars, and stuck opacity:0 elements', async () => {
      console.log('\n--- START TEST: Undersized Target, Squished Avatar & Stuck Opacity:0 Detection ---');

      if (!browser) {
        browser = await chromium.launch({ headless: true });
      }
      const context = await browser.newContext({ viewport: { width: 420, height: 600 } });
      const page = await context.newPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 16px; font-family: sans-serif; }
              .tiny-icon-btn { width: 16px; height: 16px; padding: 0; border: 1px solid #333; }
              .row { display: flex; width: 220px; align-items: center; gap: 8px; margin-top: 32px; }
              .avatar { width: 48px; height: 48px; background: #3b82f6; }
              .stuck-reveal { opacity: 0; width: 180px; height: 48px; margin-top: 32px; }
            </style>
          </head>
          <body>
            <button class="tiny-icon-btn" aria-label="Tiny">x</button>
            <div class="row">
              <div class="avatar"></div>
              <span>Long User Display Name That Expands</span>
            </div>
            <div class="stuck-reveal">Never faded in</div>
          </body>
        </html>
      `);

      const violations = await runGeometricStressAudit(page, {
        overflowPixelTolerance: 2,
        touchTargetMinSpacingPx: 24,
      });

      await context.close();

      const types = violations.map((v) => v.violationType);
      expect(types).toContain('undersized_touch_target');
      expect(types).toContain('squished_avatar');
      expect(types).toContain('stuck_invisible_element');
    });

    it('==> Should restrict stress audit violations to --selectors subtrees when selectors are provided', async () => {
      console.log('\n--- START TEST: Component-Scoped Stress Audit (--selectors) ---');

      if (!browser) {
        browser = await chromium.launch({ headless: true });
      }
      const context = await browser.newContext({ viewport: { width: 500, height: 600 } });
      const page = await context.newPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 16px; font-family: sans-serif; }
              #off-scope-box { width: 120px; border: 1px solid #ccc; }
              #off-scope-box .off-leak { display: inline-block; white-space: nowrap; font-size: 16px; }
              #scoped-card { width: 120px; border: 1px solid #ccc; margin-top: 24px; }
              #scoped-card .scoped-leak { display: inline-block; white-space: nowrap; font-size: 16px; }
            </style>
          </head>
          <body>
            <div id="off-scope-box">
              <span class="off-leak">Off-scope overflowing label</span>
            </div>
            <div id="scoped-card">
              <span class="scoped-leak">Scoped overflowing label</span>
            </div>
          </body>
        </html>
      `);

      const violations = await runGeometricStressAudit(page, {
        overflowPixelTolerance: 2,
        touchTargetMinSpacingPx: 24,
        selectors: ['#scoped-card'],
      });

      await context.close();

      expect(violations).toHaveLength(1);
      expect(violations.at(0)?.selector).toBe('span.scoped-leak');
    });
  });
});
