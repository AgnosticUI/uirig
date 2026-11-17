/**
 * @file tests/unit/spatial-brief.test.ts
 * @description 1-to-1 unit tests for `collectSpatialNodes` and `formatSpatialBrief`.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  collectSpatialNodes,
  formatSpatialBrief,
  type SpatialNode,
} from '../../src/utils/spatial-brief.js';

describe('formatSpatialBrief', () => {
  it('formats side-by-side desktop landmarks into a compact pipe-delimited string', () => {
    const nodes: Array<SpatialNode> = [
      { label: 'header', x: 0, y: 0, width: 1440, height: 64 },
      { label: 'aside', x: 0, y: 64, width: 260, height: 836 },
      { label: 'main', x: 260, y: 64, width: 1180, height: 836 },
      { label: 'footer', x: 0, y: 900, width: 1440, height: 120 },
    ];

    expect(formatSpatialBrief(nodes)).toBe(
      'header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836] | footer[0,900 1440x120]',
    );
  });

  it('sorts out-of-order nodes by top-to-bottom (y) then left-to-right (x)', () => {
    const nodes: Array<SpatialNode> = [
      { label: 'footer', x: 0, y: 900, width: 1440, height: 120 },
      { label: 'main', x: 260, y: 64, width: 1180, height: 836 },
      { label: 'header', x: 0, y: 0, width: 1440, height: 64 },
      { label: 'aside', x: 0, y: 64, width: 260, height: 836 },
    ];

    expect(formatSpatialBrief(nodes)).toBe(
      'header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836] | footer[0,900 1440x120]',
    );
  });

  it('rounds fractional sub-pixel coordinates and filters zero-size or blank-label nodes', () => {
    const nodes: Array<SpatialNode> = [
      { label: 'nav', x: 0.4, y: 0.6, width: 1439.8, height: 63.5 },
      { label: 'aside', x: 0, y: 64, width: 0, height: 500 },
      { label: 'dialog', x: 100, y: 100, width: 400, height: 0 },
      { label: '   ', x: 10, y: 10, width: 50, height: 50 },
    ];

    expect(formatSpatialBrief(nodes)).toBe('nav[0,1 1440x64]');
  });

  it('deduplicates identical landmark boxes and caps output to maxNodes', () => {
    const nodes: Array<SpatialNode> = [
      { label: 'header', x: 0, y: 0, width: 1440, height: 64 },
      { label: 'header', x: 0, y: 0, width: 1440, height: 64 },
      { label: 'aside', x: 0, y: 64, width: 260, height: 836 },
      { label: 'main', x: 260, y: 64, width: 1180, height: 836 },
    ];

    expect(formatSpatialBrief(nodes, { maxNodes: 2 })).toBe(
      'header[0,0 1440x64] | aside[0,64 260x836] | +1 more',
    );
  });

  it('returns an empty string when given no visible nodes', () => {
    expect(formatSpatialBrief(new Array<SpatialNode>())).toBe('');
  });
});

describe('collectSpatialNodes', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  it('collects visible landmarks, top-level custom hosts, open shadow landmarks, and explicit selectors', () => {
    interface MockEl {
      tagName: string;
      id: string;
      attrs: Record<string, string>;
      rect: { x: number; y: number; width: number; height: number };
      hidden?: boolean;
      shadowRoot: { querySelectorAll: (sel: string) => Array<MockEl> } | null;
      getAttribute: (name: string) => string | null;
      getBoundingClientRect: () => { x: number; y: number; width: number; height: number };
    }

    const makeEl = (
      tag: string,
      rect: { x: number; y: number; width: number; height: number },
      opts: { id?: string; role?: string; hidden?: boolean; shadowChildren?: Array<MockEl> } = {},
    ): MockEl => ({
      tagName: tag.toUpperCase(),
      id: opts.id ?? '',
      attrs: opts.role ? { role: opts.role } : {},
      rect,
      hidden: opts.hidden,
      shadowRoot: opts.shadowChildren
        ? {
            querySelectorAll: (sel: string) =>
              sel === '*'
                ? opts.shadowChildren!
                : opts.shadowChildren!.filter((c) => c.tagName.toLowerCase() === sel),
          }
        : null,
      getAttribute(name: string) {
        return this.attrs[name] ?? null;
      },
      getBoundingClientRect() {
        return this.rect;
      },
    });

    const shadowMain = makeEl('main', { x: 260, y: 64, width: 1180, height: 836 });
    const nestedLeafBadge = makeEl('ag-badge', { x: 300, y: 80, width: 40, height: 20 });
    const appShell = makeEl(
      'app-shell',
      { x: 0, y: 64, width: 1440, height: 836 },
      { shadowChildren: [shadowMain, nestedLeafBadge] },
    );
    const header = makeEl('header', { x: 0, y: 0, width: 1440, height: 64 });
    const hiddenAside = makeEl(
      'aside',
      { x: 0, y: 64, width: 260, height: 836 },
      { hidden: true },
    );

    const lightNodes: Array<MockEl> = [header, appShell, hiddenAside];

    globalThis.window = {
      getComputedStyle: (el: unknown) => {
        const mock = el as MockEl;
        return {
          display: mock.hidden ? 'none' : 'block',
          visibility: 'visible',
          opacity: '1',
        };
      },
    } as unknown as typeof window;

    globalThis.document = {
      body: {},
      querySelectorAll: (sel: string) =>
        sel === '*'
          ? lightNodes
          : lightNodes.filter((n) => n.tagName.toLowerCase() === sel),
    } as unknown as Document;

    const collected = collectSpatialNodes(['ag-badge']);
    const brief = formatSpatialBrief(collected);

    expect(brief).toBe(
      'header[0,0 1440x64] | app-shell[0,64 1440x836] | main[260,64 1180x836] | ag-badge[300,80 40x20]',
    );
  });
});
