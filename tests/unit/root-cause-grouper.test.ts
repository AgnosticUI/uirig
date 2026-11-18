/**
 * tests/unit/root-cause-grouper.test.ts
 * 1-to-1 unit test suite for `src/utils/root-cause-grouper.ts` (`--group-by-root`, Issue #11).
 * Verifies parent container extraction, Shadow DOM host grouping, Light DOM parent grouping,
 * distinct background isolation, sampleChildren capping, and singleton pass-through.
 */

import { describe, it, expect } from 'vitest';
import {
  extractParentContainerSelector,
  groupViolationsByRootCause,
} from '../../src/utils/root-cause-grouper.js';
import type { IAgenticViolation } from '../../src/utils/agent-stream.js';

function makeViolation(overrides: Partial<IAgenticViolation>): IAgenticViolation {
  return {
    engine: 'contrast',
    violationType: 'contrast_drop',
    url: 'http://localhost:5173',
    viewport: 'desktop (1440x900)',
    hostComponent: null,
    selector: 'div.card > p.body',
    inShadowDom: false,
    occurrenceCount: 1,
    measuredDelta: 'contrast 2.40:1 (required >= 4.50:1)',
    remediationAdvice:
      "Adjust foreground (rgb(160, 160, 160)) or background (rgb(255, 255, 255)) on 'div.card > p.body' so computed WCAG contrast reaches at least 4.50:1.",
    ...overrides,
  };
}

describe('Parent Container Violation Grouper (src/utils/root-cause-grouper.ts)', () => {
  it('extracts enclosing Web Component host or Light DOM parent container selector', () => {
    console.log('[TEST] Checking extractParentContainerSelector across Shadow & Light DOM...');

    expect(
      extractParentContainerSelector('ag-card#pricing >> shadow-root >> div.body > h3.title', 'ag-card')
    ).toBe('ag-card#pricing');

    expect(
      extractParentContainerSelector('section.hero > div.banner > p.subtitle', null)
    ).toBe('section.hero > div.banner');

    expect(extractParentContainerSelector('button.standalone', null)).toBe('button.standalone');
  });

  it('collapses multiple failing children inside a Web Component host into 1 root-cause violation', () => {
    console.log('[TEST] Checking Shadow DOM Web Component host grouping...');

    const v1 = makeViolation({
      hostComponent: 'ag-card',
      inShadowDom: true,
      selector: 'ag-card#pro >> shadow-root >> h3.plan-title',
    });
    const v2 = makeViolation({
      hostComponent: 'ag-card',
      inShadowDom: true,
      selector: 'ag-card#pro >> shadow-root >> p.plan-price',
    });
    const v3 = makeViolation({
      hostComponent: 'ag-card',
      inShadowDom: true,
      selector: 'ag-card#pro >> shadow-root >> span.plan-note',
    });
    const v4 = makeViolation({
      hostComponent: 'ag-card',
      inShadowDom: true,
      selector: 'ag-card#pro >> shadow-root >> small.plan-disclaimer',
    });

    const grouped = groupViolationsByRootCause([v1, v2, v3, v4]);
    expect(grouped).toHaveLength(1);

    const root = grouped.at(0);
    expect(root?.selector).toBe('ag-card#pro');
    expect(root?.hostComponent).toBe('ag-card');
    expect(root?.childCount).toBe(4);
    expect(root?.sampleChildren).toEqual([
      'ag-card#pro >> shadow-root >> h3.plan-title',
      'ag-card#pro >> shadow-root >> p.plan-price',
      'ag-card#pro >> shadow-root >> span.plan-note',
    ]);
    expect(root?.remediationAdvice).toContain("Root cause in 'ag-card#pro' (4 child elements affected)");
  });

    it('groups Light DOM children sharing the same parent container and background color', () => {
    console.log('[TEST] Checking Light DOM parent container grouping...');

    const childA = makeViolation({
      selector: 'div.promo-card > h2.heading',
    });
    const childB = makeViolation({
      selector: 'div.promo-card > p.description',
    });

    const grouped = groupViolationsByRootCause([childA, childB]);
    expect(grouped).toHaveLength(1);
    expect(grouped.at(0)?.selector).toBe('div.promo-card');
    expect(grouped.at(0)?.childCount).toBe(2);
    expect(grouped.at(0)?.sampleChildren).toEqual([
      'div.promo-card > h2.heading',
      'div.promo-card > p.description',
    ]);
  });

  it('keeps violations separate when children fail against different background colors or engines', () => {
    console.log('[TEST] Checking distinct background color and engine separation...');

    const lightBgChild = makeViolation({
      selector: 'div.panel > p.on-white',
      remediationAdvice:
        "Adjust foreground (rgb(160, 160, 160)) or background (rgb(255, 255, 255)) on 'div.panel > p.on-white' so computed WCAG contrast reaches at least 4.50:1.",
    });
    const grayBgChild = makeViolation({
      selector: 'div.panel > p.on-gray',
      measuredDelta: 'contrast 2.10:1 (required >= 4.50:1)',
      remediationAdvice:
        "Adjust foreground (rgb(140, 140, 140)) or background (rgb(220, 220, 220)) on 'div.panel > p.on-gray' so computed WCAG contrast reaches at least 4.50:1.",
    });
    const tokenChild = makeViolation({
      engine: 'tokens',
      violationType: 'token_drift',
      selector: 'div.panel > span.badge',
      measuredDelta: 'backgroundColor: #ff00ff',
    });

    const grouped = groupViolationsByRootCause([lightBgChild, grayBgChild, tokenChild]);
    expect(grouped).toHaveLength(3);
    expect(grouped.every((v) => v.childCount === undefined)).toBe(true);
  });

  it('leaves singleton violations untouched without adding childCount or sampleChildren', () => {
    console.log('[TEST] Checking singleton pass-through...');

    const single = makeViolation({
      selector: 'footer.site-footer > small.copyright',
    });

    const grouped = groupViolationsByRootCause([single]);
    expect(grouped).toHaveLength(1);
    expect(grouped.at(0)).toEqual(single);
    expect(grouped.at(0)?.childCount).toBeUndefined();
    expect(grouped.at(0)?.sampleChildren).toBeUndefined();
  });
});
