/**
 * src/core/adversary.ts
 * Geometric Invariant Overflow Rig (uirig stress).
 * Injects +30% text expansion across Light DOM and open ShadowRoots,
 * then evaluates parent-child containment bounds, viewport horizontal scrollbar leaks,
 * and interactive touch-target spacing invariants using Euclidean box math,
 * respecting `data-uirig-ignore="stress|all"`, config `ignore` rules, and `--selectors` scoping.
 */

import type { Page } from 'playwright';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
import { isElementInSelectorScope } from '../utils/scope.js';
import { createBrowserDomWalker } from '../utils/dom-walker.js';

/**
 * Axis-aligned bounding box coordinates matching browser `DOMRect` geometry.
 */
export interface IBoundingBox {
  selector: string;
  hostComponent?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  inShadowDom: boolean;
}

/**
 * Represents a single structural layout break caught by the geometric stress rig.
 * Triggers POSIX exit code 2 when emitted during CI/CD verification.
 */
export interface IGeometricViolation {
  /** Type of structural invariant broken by text expansion or viewport stress. */
  violationType:
    | 'container_overflow'
    | 'horizontal_scrollbar'
    | 'touch_target_collision'
    | 'undersized_touch_target'
    | 'squished_avatar'
    | 'stuck_invisible_element';
  /** CSS selector or Shadow DOM breadcrumb identifying the offending element. */
  selector: string;
  /** Enclosing Web Component custom element tag when inside an open ShadowRoot. */
  hostComponent?: string | null;
  /** Optional related container or neighbor selector involved in the breach. */
  relatedSelector?: string;
  /** Measured pixel breach beyond the allowed tolerance or spacing budget. */
  measuredLeakPixels: number;
  /** True if the offending element resides inside an open ShadowRoot. */
  inShadowDom: boolean;
}

/**
 * Configuration budgets passed into `runGeometricStressAudit` (mapped from `uirig.config.json`).
 */
export interface IStressAuditOptions {
  /** Allowed sub-pixel rounding buffer in pixels (default 2px). */
  overflowPixelTolerance?: number;
  /** Minimum edge-to-edge clearance between interactive controls in pixels (default 24px). */
  touchTargetMinSpacingPx?: number;
  /** Expansion multiplier applied to visible text nodes (default 0.30 for +30% length). */
  expansionRatio?: number;
  /** Optional runtime ignore rules from `uirig.config.json`. */
  ignoreRules?: IUirigIgnoreRule[];
  /** Optional CSS selectors limiting stress mutation and geometric evaluation to matching subtrees. */
  selectors?: string[];
}

/**
 * Checks whether a child element's right or bottom edge breaches its parent container's
 * bounding box beyond `overflowPixelTolerance`.
 */
export function checkParentChildOverflow(
  parent: IBoundingBox,
  child: IBoundingBox,
  overflowPixelTolerance: number = 2
): IGeometricViolation | null {
  const parentRight = parent.x + parent.width;
  const parentBottom = parent.y + parent.height;
  const childRight = child.x + child.width;
  const childBottom = child.y + child.height;

  const rightOverflow = Math.max(0, childRight - parentRight);
  const bottomOverflow = Math.max(0, childBottom - parentBottom);
  const maxOverflow = Math.max(rightOverflow, bottomOverflow);

  if (maxOverflow > overflowPixelTolerance) {
    return {
      violationType: 'container_overflow',
      selector: child.selector,
      hostComponent: child.hostComponent,
      relatedSelector: parent.selector,
      measuredLeakPixels: Math.round(maxOverflow * 100) / 100,
      inShadowDom: child.inShadowDom,
    };
  }

  return null;
}

/**
 * Checks whether the global document scroll width exceeds the active viewport width
 * beyond `overflowPixelTolerance`, which causes a rogue horizontal scrollbar.
 */
export function checkHorizontalScrollbarLeak(
  documentScrollWidth: number,
  windowInnerWidth: number,
  overflowPixelTolerance: number = 2
): IGeometricViolation | null {
  const leakPixels = documentScrollWidth - windowInnerWidth;

  if (leakPixels > overflowPixelTolerance) {
    return {
      violationType: 'horizontal_scrollbar',
      selector: 'document.documentElement',
      hostComponent: null,
      measuredLeakPixels: Math.round(leakPixels * 100) / 100,
      inShadowDom: false,
    };
  }

  return null;
}

/**
 * Checks whether two interactive touch targets (buttons, links, inputs) overlap
 * or sit closer together than `touchTargetMinSpacingPx`.
 */
export function checkTouchTargetSpacing(
  targetA: IBoundingBox,
  targetB: IBoundingBox,
  touchTargetMinSpacingPx: number = 24
): IGeometricViolation | null {
  const dx = Math.max(
    targetB.x - (targetA.x + targetA.width),
    targetA.x - (targetB.x + targetB.width)
  );
  const dy = Math.max(
    targetB.y - (targetA.y + targetA.height),
    targetA.y - (targetB.y + targetB.height)
  );

  // Case 1: Direct physical overlap (both axes overlap simultaneously)
  if (dx < 0 && dy < 0) {
    const overlapDepth = Math.min(Math.abs(dx), Math.abs(dy));
    return {
      violationType: 'touch_target_collision',
      selector: targetA.selector,
      hostComponent: targetA.hostComponent ?? targetB.hostComponent,
      relatedSelector: targetB.selector,
      measuredLeakPixels: Math.round((touchTargetMinSpacingPx + overlapDepth) * 100) / 100,
      inShadowDom: targetA.inShadowDom || targetB.inShadowDom,
    };
  }

  // Case 2: Separated rectangles — compute closest Euclidean edge-to-edge distance
  const clampedDx = Math.max(0, dx);
  const clampedDy = Math.max(0, dy);
  const edgeDistance = Math.hypot(clampedDx, clampedDy);

  if (edgeDistance < touchTargetMinSpacingPx) {
    const deficit = touchTargetMinSpacingPx - edgeDistance;
    return {
      violationType: 'touch_target_collision',
      selector: targetA.selector,
      hostComponent: targetA.hostComponent ?? targetB.hostComponent,
      relatedSelector: targetB.selector,
      measuredLeakPixels: Math.round(deficit * 100) / 100,
      inShadowDom: targetA.inShadowDom || targetB.inShadowDom,
    };
  }

  return null;
}

/**
 * Pure helper checking whether a standalone interactive touch target meets the
 * WCAG 2.5.8 minimum 24x24px bounding box size.
 */
export function checkMinimumTouchTargetSize(
  target: IBoundingBox,
  minSizePx: number = 24
): IGeometricViolation | null {
  const widthShortfall = Math.max(0, minSizePx - target.width);
  const heightShortfall = Math.max(0, minSizePx - target.height);
  const maxShortfall = Math.max(widthShortfall, heightShortfall);

  if (maxShortfall > 0.5) {
    return {
      violationType: 'undersized_touch_target',
      selector: target.selector,
      measuredLeakPixels: Math.round(maxShortfall * 100) / 100,
      inShadowDom: target.inShadowDom,
    };
  }

  return null;
}

interface IStressDomSnapshot {
  documentScrollWidth: number;
  windowInnerWidth: number;
  ignoreRootScrollLeak: boolean;
  parentChildPairs: Array<{
    parent: IBoundingBox;
    child: IBoundingBox;
  }>;
  interactiveTargets: IBoundingBox[];
  undersizedTargets: IBoundingBox[];
  squishedAvatars: Array<{
    selector: string;
    hostComponent: string | null;
    inShadowDom: boolean;
    aspectDriftPercent: number;
  }>;
  stuckInvisibleElements: Array<{
    selector: string;
    hostComponent: string | null;
    inShadowDom: boolean;
  }>;
}

/**
 * Mutates a live Playwright Page by injecting +30% text expansion and long space-free
 * strings (emails/URLs) across Light DOM and open ShadowRoot nodes (optionally scoped
 * to `options.selectors`), then evaluates containment bounds, touch targets, avatars,
 * and stuck `opacity: 0` elements.
 */
export async function runGeometricStressAudit(
  page: Page,
  options: IStressAuditOptions = {}
): Promise<IGeometricViolation[]> {
  const overflowPixelTolerance = options.overflowPixelTolerance ?? 2;
  const touchTargetMinSpacingPx = options.touchTargetMinSpacingPx ?? 24;
  const expansionRatio = options.expansionRatio ?? 0.3;
  const ignoreRules = options.ignoreRules ?? [];
  const selectors = options.selectors;
  const isScopedAudit = Boolean(selectors && selectors.length > 0);

  logTelemetry(
    'adversary:stress',
    `Injecting ${paint(
      `+${Math.round(expansionRatio * 100)}%`,
      'bold',
      'yellow'
    )} text expansion & measuring bounds...`
  );
  const snapshot = await page.evaluate(
    ({
      ratio,
      minTouchPx,
      rules,
      activeSelectors,
      walkerFactorySrc,
      ignoreHelperSrc,
      scopeHelperSrc,
    }: {
      ratio: number;
      minTouchPx: number;
      rules: IUirigIgnoreRule[];
      activeSelectors?: string[];
      walkerFactorySrc: string;
      ignoreHelperSrc: string;
      scopeHelperSrc: string;
    }): IStressDomSnapshot => {
      const buildWalker = new Function(
        `return (${walkerFactorySrc});`
      )() as typeof createBrowserDomWalker;
      const walker = buildWalker(
        window.location.href,
        rules,
        ignoreHelperSrc,
        activeSelectors,
        scopeHelperSrc
      );

      const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
      const inlineProseParents = new Set(['P', 'LI', 'BLOCKQUOTE', 'DD', 'TD', 'SPAN']);
      const pseudoGlyphs = 'Ĥéĺĺő_Ŵőŕĺď_Ťéśť_Łőćáĺé';
      const unbreakableToken = 'alexandra.van.der.berg@enterprise-platform.io';

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

      function isAvatarCandidate(el: Element): boolean {
        if (el.tagName === 'IMG') {
          const imgEl = el as HTMLImageElement;
          return (
            imgEl.classList.contains('avatar') ||
            /avatar|profile/i.test(imgEl.alt || imgEl.id || '')
          );
        }
        return el.classList.contains('avatar');
      }

      // Step 0: Record baseline avatar aspect ratios before text expansion
      const baselineAvatarRatios = new Map<Element, number>();
      walker.walkElements(
        (el) => {
          if (isAvatarCandidate(el) && !walker.isIgnored(el, 'stress')) {
            const rect = el.getBoundingClientRect();
            if (rect.width >= 20 && rect.height >= 20) {
              baselineAvatarRatios.set(el, rect.width / rect.height);
            }
          }
        },
        { includeBody: false }
      );

      // Step 1: Expand visible text nodes and inject unbreakable strings across Light + Shadow DOM
      let injectedUnbreakable = false;
      walker.walkElements((currentEl) => {
        const computed = window.getComputedStyle(currentEl);
        if (
          computed.display === 'none' ||
          computed.visibility === 'hidden' ||
          isHiddenSubtree(currentEl) ||
          walker.isIgnored(currentEl, 'stress')
        ) {
          return;
        }

        for (const child of Array.from(currentEl.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            const trimmed = (child.textContent ?? '').trim();
            if (trimmed.length > 0) {
              const extraChars = Math.max(4, Math.ceil(trimmed.length * ratio));
              const padding = pseudoGlyphs
                .repeat(Math.ceil(extraChars / pseudoGlyphs.length))
                .slice(0, extraChars);
              if (!injectedUnbreakable && currentEl.tagName === 'P' && trimmed.includes('@')) {
                child.textContent = `${trimmed} ${unbreakableToken}`;
                injectedUnbreakable = true;
              } else {
                child.textContent = `${trimmed} [${padding}]`;
              }
            }
          }
        }
      });

      // Step 2: Force synchronous reflow and collect post-expansion bounding boxes
      const parentChildPairs: Array<{ parent: IBoundingBox; child: IBoundingBox }> = [];
      const interactiveTargets: IBoundingBox[] = [];
      const undersizedTargets: IBoundingBox[] = [];
      const squishedAvatars: IStressDomSnapshot['squishedAvatars'] = [];
      const stuckInvisibleElements: IStressDomSnapshot['stuckInvisibleElements'] = [];

      walker.walkElements(
        (currentEl, meta) => {
          const computed = window.getComputedStyle(currentEl);
          if (
            computed.display === 'none' ||
            computed.visibility === 'hidden' ||
            isHiddenSubtree(currentEl) ||
            walker.isIgnored(currentEl, 'stress')
          ) {
            return;
          }

          const rect = currentEl.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) {
            return;
          }

          if (parseFloat(computed.opacity) === 0 && rect.width >= 24 && rect.height >= 24) {
            stuckInvisibleElements.push({
              selector: meta.selector,
              hostComponent: meta.hostComponent,
              inShadowDom: meta.inShadowDom,
            });
          }

          const initialRatio = baselineAvatarRatios.get(currentEl);
          if (initialRatio !== undefined && rect.height > 0) {
            const postRatio = rect.width / rect.height;
            const drift = Math.abs(postRatio - initialRatio) / initialRatio;
            if (drift > 0.15) {
              squishedAvatars.push({
                selector: meta.selector,
                hostComponent: meta.hostComponent,
                inShadowDom: meta.inShadowDom,
                aspectDriftPercent: Math.round(drift * 100),
              });
            }
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
            if (rect.width < minTouchPx || rect.height < minTouchPx) {
              undersizedTargets.push(currentBox);
            }
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
        ignoreRootScrollLeak: walker.isIgnored(document.documentElement, 'stress'),
        parentChildPairs,
        interactiveTargets,
        undersizedTargets,
        squishedAvatars,
        stuckInvisibleElements,
      };
    },
    {
      ratio: expansionRatio,
      minTouchPx: touchTargetMinSpacingPx,
      rules: ignoreRules,
      activeSelectors: selectors,
      walkerFactorySrc: createBrowserDomWalker.toString(),
      ignoreHelperSrc: isElementIgnoredInBrowser.toString(),
      scopeHelperSrc: isElementInSelectorScope.toString(),
    }
  );

  const violations: IGeometricViolation[] = [];

  if (!snapshot.ignoreRootScrollLeak && !isScopedAudit) {
    const scrollLeak = checkHorizontalScrollbarLeak(
      snapshot.documentScrollWidth,
      snapshot.windowInnerWidth,
      overflowPixelTolerance
    );
    if (scrollLeak) {
      violations.push(scrollLeak);
    }
  }

  for (const pair of snapshot.parentChildPairs) {
    const overflow = checkParentChildOverflow(pair.parent, pair.child, overflowPixelTolerance);
    if (overflow) {
      violations.push(overflow);
    }
  }

  for (const smallTarget of snapshot.undersizedTargets) {
    const deficit = Math.max(
      touchTargetMinSpacingPx - smallTarget.width,
      touchTargetMinSpacingPx - smallTarget.height
    );
    violations.push({
      violationType: 'undersized_touch_target',
      selector: smallTarget.selector,
      hostComponent: smallTarget.hostComponent,
      measuredLeakPixels: Math.round(deficit * 100) / 100,
      inShadowDom: smallTarget.inShadowDom,
    });
  }

  for (const avatar of snapshot.squishedAvatars) {
    violations.push({
      violationType: 'squished_avatar',
      selector: avatar.selector,
      hostComponent: avatar.hostComponent,
      measuredLeakPixels: avatar.aspectDriftPercent,
      inShadowDom: avatar.inShadowDom,
    });
  }

  for (const hiddenEl of snapshot.stuckInvisibleElements) {
    violations.push({
      violationType: 'stuck_invisible_element',
      selector: hiddenEl.selector,
      hostComponent: hiddenEl.hostComponent,
      measuredLeakPixels: 0,
      inShadowDom: hiddenEl.inShadowDom,
    });
  }

  for (let i = 0; i < snapshot.interactiveTargets.length; i++) {
    for (let j = i + 1; j < snapshot.interactiveTargets.length; j++) {
      const targetA = snapshot.interactiveTargets.at(i);
      const targetB = snapshot.interactiveTargets.at(j);
      if (targetA && targetB) {
        const collision = checkTouchTargetSpacing(targetA, targetB, touchTargetMinSpacingPx);
        if (collision) {
          violations.push(collision);
        }
      }
    }
  }

  const countBadge =
    violations.length > 0
      ? paint(String(violations.length), 'bold', 'red')
      : paint('0', 'bold', 'green');

  logTelemetry(
    'adversary:stress',
    `Stress audit complete. Violations detected: ${countBadge}`
  );

  return violations;
}
