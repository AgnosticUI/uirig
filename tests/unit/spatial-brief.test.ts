/**
 * @file tests/unit/spatial-brief.test.ts
 * @description 1-to-1 unit tests for `formatSpatialBrief` in `src/utils/spatial-brief.ts`.
 * Covers happy-path formatting, visual reading-order sorting, sub-pixel rounding,
 * zero-size filtering, duplicate removal, and maxNodes truncation.
 */

import { describe, expect, it } from 'vitest';
import { formatSpatialBrief, type SpatialNode } from '../../src/utils/spatial-brief.js';

describe('formatSpatialBrief', () => {
  it('formats side-by-side desktop landmarks into a compact pipe-delimited string', () => {
    console.log('[test:spatial-brief] Verifying standard desktop landmark formatting');
    const nodes: SpatialNode[] = [
      { label: 'header', x: 0, y: 0, width: 1440, height: 64 },
      { label: 'aside', x: 0, y: 64, width: 260, height: 836 },
      { label: 'main', x: 260, y: 64, width: 1180, height: 836 },
      { label: 'footer', x: 0, y: 900, width: 1440, height: 120 },
    ];

    const result = formatSpatialBrief(nodes);
    expect(result).toBe(
      'header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836] | footer[0,900 1440x120]',
    );
  });

  it('sorts out-of-order nodes by top-to-bottom (y) then left-to-right (x)', () => {
    console.log('[test:spatial-brief] Verifying visual reading-order sort (y then x)');
    const nodes: SpatialNode[] = [
      { label: 'footer', x: 0, y: 900, width: 1440, height: 120 },
      { label: 'main', x: 260, y: 64, width: 1180, height: 836 },
      { label: 'header', x: 0, y: 0, width: 1440, height: 64 },
      { label: 'aside', x: 0, y: 64, width: 260, height: 836 },
    ];

    const result = formatSpatialBrief(nodes);
    expect(result).toBe(
      'header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836] | footer[0,900 1440x120]',
    );
  });

  it('rounds fractional sub-pixel coordinates and filters zero-size or blank-label nodes', () => {
    console.log('[test:spatial-brief] Verifying rounding and hidden/zero-rect filtering');
    const nodes: SpatialNode[] = [
      { label: 'nav', x: 0.4, y: 0.6, width: 1439.8, height: 63.5 },
      { label: 'aside', x: 0, y: 64, width: 0, height: 500 },
      { label: 'dialog', x: 100, y: 100, width: 400, height: 0 },
      { label: '   ', x: 10, y: 10, width: 50, height: 50 },
    ];

    const result = formatSpatialBrief(nodes);
    expect(result).toBe('nav[0,1 1440x64]');
  });

  it('deduplicates identical landmark boxes (e.g. <header role="banner">)', () => {
    console.log('[test:spatial-brief] Verifying duplicate landmark deduplication');
    const nodes: SpatialNode[] = [
      { label: 'header', x: 0, y: 0, width: 1440, height: 64 },
      { label: 'header', x: 0, y: 0, width: 1440, height: 64 },
      { label: 'main', x: 0, y: 64, width: 1440, height: 800 },
    ];

    const result = formatSpatialBrief(nodes);
    expect(result).toBe('header[0,0 1440x64] | main[0,64 1440x800]');
  });

  it('caps output to maxNodes and appends +N more overflow indicator', () => {
    console.log('[test:spatial-brief] Verifying maxNodes token-budget cap');
    const nodes: SpatialNode[] = [
      { label: 'header', x: 0, y: 0, width: 1440, height: 64 },
      { label: 'aside', x: 0, y: 64, width: 260, height: 836 },
      { label: 'main', x: 260, y: 64, width: 1180, height: 836 },
      { label: 'footer', x: 0, y: 900, width: 1440, height: 120 },
    ];

    const result = formatSpatialBrief(nodes, { maxNodes: 2 });
    expect(result).toBe('header[0,0 1440x64] | aside[0,64 260x836] | +2 more');
  });

  it('returns an empty string when given no visible nodes', () => {
    console.log('[test:spatial-brief] Verifying empty input handling');
    expect(formatSpatialBrief([])).toBe('');
  });
});
