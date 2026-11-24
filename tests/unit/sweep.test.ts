/**
 * tests/unit/sweep.test.ts
 * Unit & live Chromium specs for `src/core/sweep.ts` (Issue #18):
 * - `parseSweepRange`, `generateSweepWidths`, and `collapseContiguousWidths`
 * - Live Chromium viewport sweep catching intermediate-width horizontal scrollbars,
 *   container overflow, and touch-target collisions collapsed into `failedWidths` ranges,
 *   plus `< 1.5s` 28-step performance benchmark.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  collapseContiguousWidths,
  generateSweepWidths,
  parseSweepRange,
  runBreakpointSweepAudit,
} from '../../src/core/sweep.js';

describe('sweep.ts — Responsive Breakpoint Sweep Engine (Issue #18)', () => {
  let browser: Browser | undefined;

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('parses min:max:step ranges, generates width steps, and collapses contiguous widths', () => {
    const parsed = parseSweepRange('320:1440:40');
    expect(parsed).toEqual({ minWidth: 320, maxWidth: 1440, stepPx: 40 });

    const widths = generateSweepWidths(parsed);
    expect(widths).toHaveLength(29);
    expect(widths.at(0)).toBe(320);
    expect(widths.at(-1)).toBe(1440);

    expect(collapseContiguousWidths([760, 800, 840, 880], 40)).toBe('760px-880px');
    expect(collapseContiguousWidths([400, 760, 800, 1020], 40)).toBe('400px, 760px-800px, 1020px');
    expect(collapseContiguousWidths([], 40)).toBe('');

    expect(() => parseSweepRange('invalid')).toThrow(/ERR_INVALID_SWEEP/);
    expect(() => parseSweepRange('1440:320:40')).toThrow(/ERR_INVALID_SWEEP/);
    expect(() => parseSweepRange('320:1440:0')).toThrow(/ERR_INVALID_SWEEP/);
  });

  it('detects intermediate-width overflow and sibling collision ranges while passing static mobile/desktop presets', async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 16px; font-family: sans-serif; }
            .toolbar { display: flex; justify-content: space-between; width: 100%; }
            .toolbar button { width: 160px; height: 40px; }
            /* Passes at 375px (stacked) and 1440px (wide), but collides in 360px-400px */
            @media (max-width: 350px) {
              .toolbar { flex-direction: column; gap: 32px; }
            }
            /* Fixed 820px banner hidden on mobile (<= 700px) and fits on desktop (>= 900px),
               causing horizontal scrollbar leak specifically across 720px-840px */
            .tablet-banner { display: none; width: 820px; height: 48px; background: #0f172a; color: #fff; }
            @media (min-width: 720px) {
              .tablet-banner { display: block; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button id="btn-left" type="button">Left Action</button>
            <button id="btn-right" type="button">Right Action</button>
          </div>
          <div class="tablet-banner">Fixed 820px tablet banner</div>
        </body>
      </html>
    `);

    const violations = await runBreakpointSweepAudit(page, {
      sweepSpec: '320:1440:40',
      viewportHeight: 800,
    });
    await context.close();

    const scrollbarHit = violations.find((v) => v.violationType === 'horizontal_scrollbar');
    expect(scrollbarHit).toBeDefined();
    expect(scrollbarHit?.failedWidths).toBe('720px-800px');
    expect(scrollbarHit?.failedWidthSteps).toEqual(Array.of(720, 760, 800));

    const collisionHit = violations.find((v) => v.violationType === 'touch_target_collision');
    expect(collisionHit).toBeDefined();
    expect(collisionHit?.failedWidths).toBe('360px');
  });

  it('completes a 28-step sweep (320px to 1440px by 40px) in under 1.5s on a standard component page', async () => {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 16px; font-family: sans-serif; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 28px; }
            .card { padding: 16px; border: 1px solid #cbd5e1; border-radius: 8px; }
          </style>
        </head>
        <body>
          <main class="grid">
            <article class="card"><h2>Card 1</h2><p>Responsive content block</p></article>
            <article class="card"><h2>Card 2</h2><p>Responsive content block</p></article>
            <article class="card"><h2>Card 3</h2><p>Responsive content block</p></article>
          </main>
        </body>
      </html>
    `);

    const startMs = performance.now();
    const violations = await runBreakpointSweepAudit(page, {
      sweepSpec: '320:1440:40',
      viewportHeight: 800,
    });
    const elapsedMs = performance.now() - startMs;
    await context.close();

    expect(violations).toEqual([]);
    expect(elapsedMs).toBeLessThan(1500);
  });
});
