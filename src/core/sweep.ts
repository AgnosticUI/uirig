/**
 * src/core/sweep.ts
 * Responsive Breakpoint Sweep Engine (`uirig check --sweep`).
 * Steps an already-open Chromium `Page` viewport across `[minWidth, maxWidth, stepPx]`
 * via `page.setViewportSize`, evaluates fast bounding-box horizontal overflow and
 * sibling touch-target collision math across Light DOM + open ShadowRoots at each step,
 * and collapses contiguous failing widths into clean ranges (e.g., `"760px-880px"`).
 */

import type { Page } from 'playwright';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
import { isElementInSelectorScope } from '../utils/scope.js';
import { createBrowserDomWalker } from '../utils/dom-walker.js';
import {
  checkHorizontalScrollbarLeak,
  checkParentChildOverflow,
  checkTouchTargetSpacing,
  type IBoundingBox,
  type IGeometricViolation,
} from './adversary.js';

export const DEFAULT_SWEEP_SPEC = '320:1440:40';
export const DEFAULT_SWEEP_HEIGHT = 800;

export interface IBreakpointSweepRange {
  minWidth: number;
  maxWidth: number;
  stepPx: number;
}

export interface IBreakpointSweepViolation {
  violationType: 'horizontal_scrollbar' | 'container_overflow' | 'touch_target_collision';
  selector: string;
  hostComponent?: string | null;
  relatedSelector?: string;
  /** Collapsed contiguous failing width range(s) (e.g., `"760px-880px"` or `"400px, 760px-880px"`). */
  failedWidths: string;
  /** Exact sorted list of failing viewport widths in pixels. */
  failedWidthSteps: Array<number>;
  /** Worst measured pixel leak or spacing deficit across the failing width steps. */
  measuredLeakPixels: number;
  inShadowDom: boolean;
}

export interface IBreakpointSweepOptions {
  /** Range string `"min:max:step"` (defaults to `"320:1440:40"`). */
  sweepSpec?: string;
  /** Fixed viewport height held constant while stepping width (defaults to `800`). */
  viewportHeight?: number;
  /** Allowed sub-pixel rounding buffer in pixels (defaults to `2`). */
  overflowPixelTolerance?: number;
  /** Minimum edge-to-edge clearance between interactive controls in pixels (defaults to `24`). */
  touchTargetMinSpacingPx?: number;
  /** Optional runtime ignore rules from `uirig.config.json`. */
  ignoreRules?: Array<IUirigIgnoreRule>;
  /** Optional CSS selectors scoping element checks to matching subtrees. */
  selectors?: Array<string>;
}

/**
 * Parses a `"min:max:step"` breakpoint sweep specification string (e.g. `"320:1440:40"`).
 * Throws an `ERR_INVALID_SWEEP` error if the syntax or bounds are invalid.
 */
export function parseSweepRange(rawSpec: string = DEFAULT_SWEEP_SPEC): IBreakpointSweepRange {
  const trimmed = rawSpec.trim();
  const match = /^(\d+):(\d+):(\d+)$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `ERR_INVALID_SWEEP: Invalid --sweep specification '${rawSpec}'. Expected '<min>:<max>:<step>' in pixels (e.g. '320:1440:40').`
    );
  }

  const [, rawMin = '', rawMax = '', rawStep = ''] = match;
  const minWidth = Number.parseInt(rawMin, 10);
  const maxWidth = Number.parseInt(rawMax, 10);
  const stepPx = Number.parseInt(rawStep, 10);

  if (
    !Number.isSafeInteger(minWidth) ||
    !Number.isSafeInteger(maxWidth) ||
    !Number.isSafeInteger(stepPx) ||
    minWidth < 200 ||
    maxWidth > 7680 ||
    minWidth > maxWidth ||
    stepPx < 1
  ) {
    throw new Error(
      `ERR_INVALID_SWEEP: Invalid --sweep bounds '${rawSpec}'. Require 200 <= min <= max <= 7680 and step >= 1 (e.g. '320:1440:40').`
    );
  }

  return { minWidth, maxWidth, stepPx };
}


/**
 * Expands an `IBreakpointSweepRange` into an ordered list of integer viewport widths (inclusive).
 */
export function generateSweepWidths(range: IBreakpointSweepRange): Array<number> {
  const widths = new Array<number>();
  for (let w = range.minWidth; w <= range.maxWidth; w += range.stepPx) {
    widths.push(w);
  }
  return widths;
}

/**
 * Collapses a sorted or unsorted array of failing viewport widths into human- and agent-readable
 * contiguous range labels using `stepPx` (e.g. `[760, 800, 840, 880]` with `stepPx=40` -> `"760px-880px"`).
 */
export function collapseContiguousWidths(widths: ReadonlyArray<number>, stepPx: number): string {
  const uniqueSorted = Array.from(new Set(widths)).sort((a, b) => a - b);
  const first = uniqueSorted.at(0);
  if (first === undefined) {
    return '';
  }

  const ranges = new Array<string>();
  let rangeStart = first;
  let rangePrev = first;

  for (let i = 1; i < uniqueSorted.length; i++) {
    const current = uniqueSorted[i] as number;
    if (current - rangePrev <= stepPx) {
      rangePrev = current;
    } else {
      ranges.push(rangeStart === rangePrev ? `${rangeStart}px` : `${rangeStart}px-${rangePrev}px`);
      rangeStart = current;
      rangePrev = current;
    }
  }

  ranges.push(rangeStart === rangePrev ? `${rangeStart}px` : `${rangeStart}px-${rangePrev}px`);
  return ranges.join(', ');
}
interface ISweepStepDomSnapshot {
  documentScrollWidth: number;
  windowInnerWidth: number;
  ignoreRootScrollLeak: boolean;
  parentChildPairs: Array<{
    parent: IBoundingBox;
    child: IBoundingBox;
  }>;
  interactiveTargets: Array<IBoundingBox>;
}

async function evaluateSweepStepGeometry(
  page: Page,
  options: {
    overflowPixelTolerance: number;
    touchTargetMinSpacingPx: number;
    ignoreRules: Array<IUirigIgnoreRule>;
    selectors?: Array<string>;
    walkerFactorySrc: string;
    ignoreHelperSrc: string;
    scopeHelperSrc: string;
  }
): Promise<Array<IGeometricViolation>> {
  const isScopedAudit = Boolean(options.selectors && options.selectors.length > 0);

  const snapshot = await page.evaluate(
    ({
      rules,
      activeSelectors,
      walkerFactory,
      ignoreHelper,
      scopeHelper,
    }: {
      rules: Array<IUirigIgnoreRule>;
      activeSelectors?: Array<string>;
      walkerFactory: string;
      ignoreHelper: string;
      scopeHelper: string;
    }): ISweepStepDomSnapshot => {
      const buildWalker = new Function(
        `return (${walkerFactory});`
      )() as typeof createBrowserDomWalker;
      const walker = buildWalker(
        window.location.href,
        rules,
        ignoreHelper,
        activeSelectors,
        scopeHelper
      );

      const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
      const inlineProseParents = new Set(['P', 'LI', 'BLOCKQUOTE', 'DD', 'TD', 'SPAN']);

      function isHiddenSubtree(el: Element): boolean {
        if (
          el.classList.contains('sr-only') ||
          el.classList.contains('visually-hidden') ||
          el.closest('.sr-only, .visually-hidden, [aria-hidden="true"], [inert]')
        ) {
          return true;
        }
        let cursor: Element | null = el.parentElement;
        while (cursor) {
          if (cursor.getAttribute('aria-expanded') === 'false') {
            return true;
          }
          cursor = cursor.parentElement;
        }
        return false;
      }

      function isStandaloneInteractiveControl(el: Element): boolean {
        const tag = el.tagName;
        if (tag === 'INPUT' && (el.getAttribute('type') ?? '').toLowerCase() === 'hidden') {
          return false;
        }
        if (tag === 'A' && el.parentElement && inlineProseParents.has(el.parentElement.tagName)) {
          return false;
        }
        if (interactiveTags.has(tag)) {
          return true;
        }
        const role = el.getAttribute('role');
        return role === 'button' || role === 'link' || role === 'tab';
      }

      const parentChildPairs = new Array<{ parent: IBoundingBox; child: IBoundingBox }>();
      const interactiveTargets = new Array<IBoundingBox>();

      walker.walkElements(
        (currentEl, meta) => {
          const computed = window.getComputedStyle(currentEl);
          if (
            computed.display === 'none' ||
            computed.visibility === 'hidden' ||
            isHiddenSubtree(currentEl) ||
            walker.isIgnored(currentEl, 'sweep')
          ) {
            return;
          }

          const rect = currentEl.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) {
            return;
          }

          const currentBox: IBoundingBox = {
            selector: meta.selector,
            hostComponent: meta.hostComponent,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            inShadowDom: meta.inShadowDom,
          };

          if (isStandaloneInteractiveControl(currentEl)) {
            interactiveTargets.push(currentBox);
          }

          const parentEl = currentEl.parentElement;
          if (
            parentEl &&
            parentEl.tagName !== 'HTML' &&
            parentEl.tagName !== 'BODY' &&
            computed.position !== 'fixed'
          ) {
            const parentComputed = window.getComputedStyle(parentEl);
            const parentRect = parentEl.getBoundingClientRect();

            const clipsHorizontal =
              parentComputed.overflowX === 'auto' ||
              parentComputed.overflowX === 'scroll' ||
              parentComputed.overflowX === 'hidden';
            const clipsVertical =
              parentComputed.overflowY === 'auto' ||
              parentComputed.overflowY === 'scroll' ||
              parentComputed.overflowY === 'hidden';

            if (
              !clipsHorizontal &&
              !clipsVertical &&
              parentRect.width > 0 &&
              parentRect.height > 0
            ) {
              const parentLabel = walker.formatSelector(parentEl);
              const shadowBoundary = meta.selector.lastIndexOf(' >> shadow-root >> ');
              const parentFullSelector =
                shadowBoundary !== -1
                  ? `${meta.selector.slice(0, shadowBoundary + ' >> shadow-root >> '.length)}${parentLabel}`
                  : parentLabel;

              parentChildPairs.push({
                parent: {
                  selector: parentFullSelector,
                  hostComponent: meta.hostComponent,
                  x: parentRect.left,
                  y: parentRect.top,
                  width: parentRect.width,
                  height: parentRect.height,
                  inShadowDom: meta.inShadowDom,
                },
                child: currentBox,
              });
            }
          }
        },
        { includeBody: false }
      );

      return {
        documentScrollWidth: document.documentElement.scrollWidth,
        windowInnerWidth: window.innerWidth,
        ignoreRootScrollLeak: walker.isIgnored(document.documentElement, 'sweep'),
        parentChildPairs,
        interactiveTargets,
      };
    },
    {
      rules: options.ignoreRules,
      activeSelectors: options.selectors,
      walkerFactory: options.walkerFactorySrc,
      ignoreHelper: options.ignoreHelperSrc,
      scopeHelper: options.scopeHelperSrc,
    }
  );

  const violations = new Array<IGeometricViolation>();

  if (!snapshot.ignoreRootScrollLeak && !isScopedAudit) {
    const scrollLeak = checkHorizontalScrollbarLeak(
      snapshot.documentScrollWidth,
      snapshot.windowInnerWidth,
      options.overflowPixelTolerance
    );
    if (scrollLeak) {
      violations.push(scrollLeak);
    }
  }

  for (const pair of snapshot.parentChildPairs) {
    const overflow = checkParentChildOverflow(pair.parent, pair.child, options.overflowPixelTolerance);
    if (overflow) {
      violations.push(overflow);
    }
  }

  for (let i = 0; i < snapshot.interactiveTargets.length; i++) {
    for (let j = i + 1; j < snapshot.interactiveTargets.length; j++) {
      const targetA = snapshot.interactiveTargets.at(i);
      const targetB = snapshot.interactiveTargets.at(j);
      if (targetA && targetB) {
        const collision = checkTouchTargetSpacing(
          targetA,
          targetB,
          options.touchTargetMinSpacingPx
        );
        if (collision) {
          violations.push(collision);
        }
      }
    }
  }

  return violations;
}

/**
 * Steps an already-open Chromium `Page` across every width in `options.sweepSpec`
 * via `page.setViewportSize`, measures horizontal overflow and sibling collisions at each
 * width, and collapses contiguous failing widths into clean range descriptors.
 */
export async function runBreakpointSweepAudit(
  page: Page,
  options: IBreakpointSweepOptions = {}
): Promise<Array<IBreakpointSweepViolation>> {
  const range = parseSweepRange(options.sweepSpec ?? DEFAULT_SWEEP_SPEC);
  const widths = generateSweepWidths(range);
  const viewportHeight = options.viewportHeight ?? DEFAULT_SWEEP_HEIGHT;
  const overflowPixelTolerance = options.overflowPixelTolerance ?? 2;
  const touchTargetMinSpacingPx = options.touchTargetMinSpacingPx ?? 24;
  const ignoreRules = options.ignoreRules ?? new Array<IUirigIgnoreRule>();
  const selectors = options.selectors;
  const originalViewport = page.viewportSize();

  logTelemetry(
    'sweep:start',
    `Sweeping ${paint(String(widths.length), 'bold', 'cyan')} viewport widths (${range.minWidth}px -> ${range.maxWidth}px, step ${range.stepPx}px)...`
  );

  interface IAggregatedSweepBucket {
    violationType: IBreakpointSweepViolation['violationType'];
    selector: string;
    hostComponent?: string | null;
    relatedSelector?: string;
    inShadowDom: boolean;
    failedWidthSteps: Array<number>;
    maxLeakPixels: number;
  }

  const buckets = new Map<string, IAggregatedSweepBucket>();
  const walkerFactorySrc = createBrowserDomWalker.toString();
  const ignoreHelperSrc = isElementIgnoredInBrowser.toString();
  const scopeHelperSrc = isElementInSelectorScope.toString();

  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: viewportHeight });

      const stepViolations = await evaluateSweepStepGeometry(page, {
        overflowPixelTolerance,
        touchTargetMinSpacingPx,
        ignoreRules,
        selectors,
        walkerFactorySrc,
        ignoreHelperSrc,
        scopeHelperSrc,
      });

      for (const hit of stepViolations) {
        const sweepType =
          hit.violationType === 'horizontal_scrollbar' ||
          hit.violationType === 'container_overflow' ||
          hit.violationType === 'touch_target_collision'
            ? hit.violationType
            : 'container_overflow';

        const key = [
          sweepType,
          hit.selector,
          hit.relatedSelector ?? '',
          hit.hostComponent ?? '',
        ].join('::');

        const existing = buckets.get(key);
        if (!existing) {
          buckets.set(key, {
            violationType: sweepType,
            selector: hit.selector,
            hostComponent: hit.hostComponent,
            relatedSelector: hit.relatedSelector,
            inShadowDom: hit.inShadowDom,
            failedWidthSteps: [width],
            maxLeakPixels: hit.measuredLeakPixels,
          });
        } else {
          if (!existing.failedWidthSteps.includes(width)) {
            existing.failedWidthSteps.push(width);
          }
          if (hit.measuredLeakPixels > existing.maxLeakPixels) {
            existing.maxLeakPixels = hit.measuredLeakPixels;
          }
        }
      }
    }
  } finally {
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
    }
  }

  const results = new Array<IBreakpointSweepViolation>();
  for (const bucket of buckets.values()) {
    const sortedSteps = [...bucket.failedWidthSteps].sort((a, b) => a - b);
    results.push({
      violationType: bucket.violationType,
      selector: bucket.selector,
      hostComponent: bucket.hostComponent,
      ...(bucket.relatedSelector ? { relatedSelector: bucket.relatedSelector } : {}),
      failedWidths: collapseContiguousWidths(sortedSteps, range.stepPx),
      failedWidthSteps: sortedSteps,
      measuredLeakPixels: bucket.maxLeakPixels,
      inShadowDom: bucket.inShadowDom,
    });
  }

  const countBadge =
    results.length > 0
      ? paint(String(results.length), 'bold', 'red')
      : paint('0', 'bold', 'green');

  logTelemetry(
    'sweep:audit',
    `Breakpoint sweep complete (${widths.length} steps). Offending selectors: ${countBadge}`
  );

  return results;
}
