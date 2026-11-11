/**
 * tests/unit/adversary.test.ts
 * Focused unit specs verifying parent-child bounding box overflow, horizontal
 * scrollbar leak detection, and interactive touch-target spacing invariants.
 */
import { describe, it, expect } from 'vitest';
import {
  checkParentChildOverflow,
  checkHorizontalScrollbarLeak,
  checkTouchTargetSpacing,
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
});
