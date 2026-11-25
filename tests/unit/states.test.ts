/**
 * tests/unit/states.test.ts
 * 1-to-1 unit & Chromium integration tests for `src/core/states.ts`.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { chromium } from 'playwright';
import {
  hasVisibleFocusIndicatorDelta,
  computeClippedViewportRect,
  computeSafeSamplePoints,
  collectClickOcclusionViolations,
  runInteractiveStatesAudit,
  type IFocusIndicatorStyleSnapshot,
} from '../../src/core/states.js';

function createBaseFocusSnapshot(
  overrides: Partial<IFocusIndicatorStyleSnapshot> = {}
): IFocusIndicatorStyleSnapshot {
  return {
    outlineStyle: 'none',
    outlineWidth: '0px',
    outlineColor: 'rgb(17, 24, 39)',
    outlineOffset: '0px',
    boxShadow: 'none',
    borderTopColor: 'rgb(209, 213, 219)',
    borderRightColor: 'rgb(209, 213, 219)',
    borderBottomColor: 'rgb(209, 213, 219)',
    borderLeftColor: 'rgb(209, 213, 219)',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    backgroundColor: 'rgb(255, 255, 255)',
    color: 'rgb(17, 24, 39)',
    textDecorationLine: 'none',
    ...overrides,
  };
}

describe('states.ts — Pure Interactive State & Clipping Evaluators', () => {
  it('returns false when :focus-visible produces zero visual style change (e.g. outline: none)', () => {
    const rest = createBaseFocusSnapshot();
    const focused = createBaseFocusSnapshot();
    expect(hasVisibleFocusIndicatorDelta(rest, focused)).toBe(false);
  });

  it('returns true when :focus-visible adds a visible outline, box-shadow ring, border change, or background shift', () => {
    const rest = createBaseFocusSnapshot();

    expect(
      hasVisibleFocusIndicatorDelta(
        rest,
        createBaseFocusSnapshot({
          outlineStyle: 'solid',
          outlineWidth: '2px',
          outlineColor: 'rgb(37, 99, 235)',
        })
      )
    ).toBe(true);

    expect(
      hasVisibleFocusIndicatorDelta(
        rest,
        createBaseFocusSnapshot({
          boxShadow: 'rgb(37, 99, 235) 0px 0px 0px 3px',
        })
      )
    ).toBe(true);

    expect(
      hasVisibleFocusIndicatorDelta(
        rest,
        createBaseFocusSnapshot({
          borderTopColor: 'rgb(37, 99, 235)',
          borderRightColor: 'rgb(37, 99, 235)',
          borderBottomColor: 'rgb(37, 99, 235)',
          borderLeftColor: 'rgb(37, 99, 235)',
        })
      )
    ).toBe(true);

    expect(
      hasVisibleFocusIndicatorDelta(
        rest,
        createBaseFocusSnapshot({
          backgroundColor: 'rgb(239, 246, 255)',
        })
      )
    ).toBe(true);
  });

  it('clips target rectangles against overflow ancestors and viewport bounds, returning null when off-screen or collapsed', () => {
    // Collapsed accordion (`max-height: 0; overflow: hidden`)
    expect(
      computeClippedViewportRect(
        { left: 20, top: 100, right: 220, bottom: 140 },
        [{ left: 20, top: 100, right: 220, bottom: 100 }],
        1280,
        800
      )
    ).toBeNull();

    // Scrolled below the fold (`top >= viewportHeight`)
    expect(
      computeClippedViewportRect(
        { left: 20, top: 920, right: 220, bottom: 960 },
        [],
        1280,
        800
      )
    ).toBeNull();

    // Partially clipped inside a scrollable container
    expect(
      computeClippedViewportRect(
        { left: 20, top: 80, right: 220, bottom: 140 },
        [{ left: 20, top: 100, right: 220, bottom: 200 }],
        1280,
        800
      )
    ).toEqual({ left: 20, top: 100, right: 220, bottom: 140 });
  });

  it('computes center (50%) and safely inset (25% / 75%) sample points to avoid rounded pill corners', () => {
    const points = computeSafeSamplePoints({ left: 100, top: 200, right: 300, bottom: 240 });
    expect(points).toEqual([
      { label: 'center', x: 200, y: 220 },
      { label: 'top-left', x: 150, y: 210 },
      { label: 'bottom-right', x: 250, y: 230 },
    ]);

    // Tiny control (<12px) samples center only
    expect(computeSafeSamplePoints({ left: 10, top: 10, right: 18, bottom: 18 })).toEqual([
      { label: 'center', x: 14, y: 14 },
    ]);
  });
});

describe('states.ts — Live Chromium Click-Occlusion Collector', () => {
  const browserPromise = chromium.launch({ headless: true });

  afterAll(async () => {
    const browser = await browserPromise;
    await browser.close();
  });

  it('flags buttons occluded by opaque or transparent (opacity: 0) overlays while exempting pointer-events: none backdrops, floating labels, clipped accordions, and Shadow DOM host buttons', async () => {
    const browser = await browserPromise;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 16px; font-family: sans-serif; }
              .stack { position: relative; width: 200px; height: 48px; margin-bottom: 16px; }
              .stack button, .stack .overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
              .stealer { background: rgba(0, 0, 0, 0); opacity: 0; z-index: 10; }
              .passthrough { pointer-events: none; z-index: 10; }
              .floating-wrap { position: relative; width: 220px; height: 44px; margin-bottom: 16px; }
              .floating-wrap input, .floating-wrap label { position: absolute; inset: 0; }
              .collapsed-accordion { max-height: 0; overflow: hidden; }
            </style>
          </head>
          <body>
            <!-- 1. True occlusion by transparent click-stealer -->
            <div class="stack">
              <button id="blocked-btn">Blocked Action</button>
              <div id="click-stealer" class="overlay stealer"></div>
            </div>

            <!-- 2. Safe pointer-events: none decorative overlay -->
            <div class="stack">
              <button id="safe-btn">Safe Action</button>
              <div class="overlay passthrough"></div>
            </div>

            <!-- 3. Safe floating <label for="email-input"> overlay -->
            <div class="floating-wrap">
              <input id="email-input" type="email" />
              <label for="email-input">Email Address</label>
            </div>

            <!-- 4. Safe collapsed accordion button (overflow: hidden; max-height: 0) -->
            <div class="collapsed-accordion">
              <button id="hidden-accordion-btn">Inside Collapsed Panel</button>
            </div>

            <!-- 5. Safe custom element <my-button tabindex="0"> with inner Shadow DOM button -->
            <div id="shadow-host-wrap"></div>
            <script>
              class MyButton extends HTMLElement {
                constructor() {
                  super();
                  const root = this.attachShadow({ mode: 'open' });
                  root.innerHTML = '<button part="btn">Shadow Host Action</button>';
                }
              }
              customElements.define('my-button', MyButton);
              const host = document.createElement('my-button');
              host.setAttribute('tabindex', '0');
              document.getElementById('shadow-host-wrap').appendChild(host);
            </script>
          </body>
        </html>
      `);

      const violations = await collectClickOcclusionViolations(page);
      expect(violations).toHaveLength(1);
      expect(violations.at(0)).toMatchObject({
        violationType: 'click_occluded',
        selector: 'button#blocked-btn',
        occludingSelector: expect.stringContaining('div#click-stealer'),
        inShadowDom: false,
      });
    } finally {
      await context.close();
    }
  });

  it('detects click occlusion inside nested open Shadow DOM boundaries', async () => {
    const browser = await browserPromise;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <ag-modal id="trapped-modal"></ag-modal>
            <script>
              class AgModal extends HTMLElement {
                constructor() {
                  super();
                  const root = this.attachShadow({ mode: 'open' });
                  root.innerHTML = \`
                    <div style="position: relative; width: 180px; height: 44px;">
                      <button id="inner-submit" style="position: absolute; inset: 0;">Submit</button>
                      <div class="glass-shield" style="position: absolute; inset: 0; z-index: 5;"></div>
                    </div>
                  \`;
                }
              }
              customElements.define('ag-modal', AgModal);
            </script>
          </body>
        </html>
      `);

      const violations = await collectClickOcclusionViolations(page);
      expect(violations).toHaveLength(1);
      expect(violations.at(0)).toMatchObject({
        violationType: 'click_occluded',
        selector: 'ag-modal#trapped-modal >> shadow-root >> button#inner-submit',
        hostComponent: 'ag-modal',
        occludingSelector: 'ag-modal#trapped-modal >> shadow-root >> div >> div.glass-shield',
        inShadowDom: true,
      });
    } finally {
      await context.close();
    }
  });
});

describe('states.ts — Full Interactive States Gate (CDP :focus-visible + Occlusion)', () => {
  const browserPromise = chromium.launch({ headless: true });

  afterAll(async () => {
    const browser = await browserPromise;
    await browser.close();
  });

  it('flags buttons with outline: none and zero :focus-visible style delta across Light DOM and open Shadow DOM while passing accessible focus rings', async () => {
    const browser = await browserPromise;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 16px; font-family: sans-serif; }
              button.no-ring { outline: none; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; padding: 8px 16px; }
              button.no-ring:focus, button.no-ring:focus-visible { outline: none; box-shadow: none; }
              button.good-ring { outline: none; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; padding: 8px 16px; }
              button.good-ring:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
            </style>
          </head>
          <body>
            <button id="broken-focus-btn" class="no-ring">No Focus Ring</button>
            <button id="accessible-focus-btn" class="good-ring">Accessible Focus Ring</button>
            <ag-card id="shadow-card"></ag-card>
            <script>
              class AgCard extends HTMLElement {
                constructor() {
                  super();
                  const root = this.attachShadow({ mode: 'open' });
                  root.innerHTML = \`
                    <style>
                      button { outline: none; background: #f8fafc; border: 1px solid #94a3b8; padding: 8px 12px; }
                      button:focus-visible { outline: none; }
                    </style>
                    <button id="shadow-no-ring">Shadow No Focus</button>
                  \`;
                }
              }
              customElements.define('ag-card', AgCard);
            </script>
          </body>
        </html>
      `);

      const violations = await runInteractiveStatesAudit(page);
      expect(violations).toHaveLength(2);
      expect(violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            violationType: 'missing_focus_visible',
            selector: 'button#broken-focus-btn',
            inShadowDom: false,
          }),
          expect.objectContaining({
            violationType: 'missing_focus_visible',
            selector: 'ag-card#shadow-card >> shadow-root >> button#shadow-no-ring',
            hostComponent: 'ag-card',
            inShadowDom: true,
          }),
        ])
      );
    } finally {
      await context.close();
    }
  });
});
