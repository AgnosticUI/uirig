/**
 * src/core/adversary.ts
 * Geometric Invariant Overflow Rig (uirig stress).
 * Injects +30% text expansion across Light DOM and open ShadowRoots,
 * then evaluates parent-child containment bounds, viewport horizontal scrollbar leaks,
 * and interactive touch-target spacing invariants using Euclidean box math,
 * respecting `data-uirig-ignore="stress|all"` and config `ignore` rules.
 */

import type { Page } from 'playwright';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';

/**
 * Axis-aligned bounding box coordinates matching browser `DOMRect` geometry.
 */
export interface IBoundingBox {
  selector: string;
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
  violationType: 'container_overflow' | 'horizontal_scrollbar' | 'touch_target_collision';
  /** CSS selector or Shadow DOM breadcrumb identifying the offending element. */
  selector: string;
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
      relatedSelector: targetB.selector,
      measuredLeakPixels: Math.round(deficit * 100) / 100,
      inShadowDom: targetA.inShadowDom || targetB.inShadowDom,
    };
  }

  return null;
}
/**
 * Snapshot payload returned from Playwright's `page.evaluate()` after +30% text expansion.
 */
interface IStressDomSnapshot {
  documentScrollWidth: number;
  windowInnerWidth: number;
  ignoreRootScrollLeak: boolean;
  parentChildPairs: Array<{
    parent: IBoundingBox;
    child: IBoundingBox;
  }>;
  interactiveTargets: IBoundingBox[];
}

/**
 * Mutates a live Playwright Page by injecting +30% text expansion across Light DOM
 * and open ShadowRoot nodes, then evaluates parent-child containment, global horizontal
 * scrollbar leaks, and interactive touch-target spacing invariants.
 */
export async function runGeometricStressAudit(
  page: Page,
  options: IStressAuditOptions = {}
): Promise<IGeometricViolation[]> {
  const overflowPixelTolerance = options.overflowPixelTolerance ?? 2;
  const touchTargetMinSpacingPx = options.touchTargetMinSpacingPx ?? 24;
  const expansionRatio = options.expansionRatio ?? 0.3;
  const ignoreRules = options.ignoreRules ?? [];

  logTelemetry(
    'adversary:stress',
    `Injecting ${paint(
      `+${Math.round(expansionRatio * 100)}%`,
      'bold',
      'yellow'
    )} text expansion & measuring bounds...`
  );

  const ignoreHelperSource = isElementIgnoredInBrowser.toString();

  const snapshot = await page.evaluate(
    ({
      ratio,
      rules,
      helperFn,
    }: {
      ratio: number;
      rules: IUirigIgnoreRule[];
      helperFn: string;
    }): IStressDomSnapshot => {
      const checkIgnored = new Function(`return (${helperFn});`)() as typeof isElementIgnoredInBrowser;
      const currentUrl = window.location.href;

      const nonVisualTags = new Set([
        'HTML',
        'HEAD',
        'SCRIPT',
        'STYLE',
        'META',
        'LINK',
        'NOSCRIPT',
        'TEMPLATE',
        'SLOT',
      ]);

      const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
      const pseudoGlyphs = 'Ĥéĺĺő_Ŵőŕĺď_Ťéśť_Łőćáĺé';

      function formatSelector(el: Element): string {
        const tagName = el.tagName.toLowerCase();
        if (el.id) {
          return `${tagName}#${el.id}`;
        }
        if (typeof el.className === 'string' && el.className.trim().length > 0) {
          const classList = el.className.trim().split(/\s+/).join('.');
          return `${tagName}.${classList}`;
        }
        return tagName;
      }

      function isInteractiveControl(el: Element): boolean {
        if (interactiveTags.has(el.tagName)) {
          return true;
        }
        const role = el.getAttribute('role');
        return role === 'button' || role === 'link' || role === 'tab';
      }

      // Step 1: Expand visible text nodes across Light DOM and open ShadowRoots
      function expandTextsInRoot(root: Document | ShadowRoot): void {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let currentEl = walker.nextNode() as Element | null;

        while (currentEl) {
          if (!nonVisualTags.has(currentEl.tagName)) {
            const computed = window.getComputedStyle(currentEl);
            if (
              computed.display !== 'none' &&
              computed.visibility !== 'hidden' &&
              !checkIgnored(currentEl, 'stress', currentUrl, rules)
            ) {
              for (const child of Array.from(currentEl.childNodes)) {
                if (child.nodeType === Node.TEXT_NODE) {
                  const rawText = child.textContent ?? '';
                  const trimmed = rawText.trim();
                  if (trimmed.length > 0) {
                    const extraChars = Math.max(4, Math.ceil(trimmed.length * ratio));
                    const padding = pseudoGlyphs
                      .repeat(Math.ceil(extraChars / pseudoGlyphs.length))
                      .slice(0, extraChars);
                    child.textContent = `${trimmed} [${padding}]`;
                  }
                }
              }
            }

            if (currentEl.shadowRoot) {
              expandTextsInRoot(currentEl.shadowRoot);
            }
          }
          currentEl = walker.nextNode() as Element | null;
        }
      }

      expandTextsInRoot(document);

      // Step 2: Force synchronous reflow and collect post-expansion bounding boxes
      const parentChildPairs: Array<{ parent: IBoundingBox; child: IBoundingBox }> = [];
      const interactiveTargets: IBoundingBox[] = [];

      function measureRoot(
        root: Document | ShadowRoot,
        shadowPrefix: string,
        insideShadow: boolean
      ): void {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let currentEl = walker.nextNode() as Element | null;

        while (currentEl) {
          if (!nonVisualTags.has(currentEl.tagName) && currentEl.tagName !== 'BODY') {
            const computed = window.getComputedStyle(currentEl);
            const elementLabel = formatSelector(currentEl);
            const fullSelector = shadowPrefix ? `${shadowPrefix} >> ${elementLabel}` : elementLabel;

            if (
              computed.display !== 'none' &&
              computed.visibility !== 'hidden' &&
              !checkIgnored(currentEl, 'stress', currentUrl, rules)
            ) {
              const rect = currentEl.getBoundingClientRect();

              if (rect.width > 0 && rect.height > 0) {
                const currentBox: IBoundingBox = {
                  selector: fullSelector,
                  x: rect.left,
                  y: rect.top,
                  width: rect.width,
                  height: rect.height,
                  inShadowDom: insideShadow,
                };

                if (isInteractiveControl(currentEl)) {
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
                    const parentLabel = formatSelector(parentEl);
                    const parentFullSelector = shadowPrefix
                      ? `${shadowPrefix} >> ${parentLabel}`
                      : parentLabel;

                    parentChildPairs.push({
                      parent: {
                        selector: parentFullSelector,
                        x: parentRect.left,
                        y: parentRect.top,
                        width: parentRect.width,
                        height: parentRect.height,
                        inShadowDom: insideShadow,
                      },
                      child: currentBox,
                    });
                  }
                }
              }
            }

            if (currentEl.shadowRoot) {
              const nextShadowPrefix = `${fullSelector} >> shadow-root`;
              measureRoot(currentEl.shadowRoot, nextShadowPrefix, true);
            }
          }

          currentEl = walker.nextNode() as Element | null;
        }
      }

      measureRoot(document, '', false);

      return {
        documentScrollWidth: document.documentElement.scrollWidth,
        windowInnerWidth: window.innerWidth,
        ignoreRootScrollLeak: checkIgnored(document.documentElement, 'stress', currentUrl, rules),
        parentChildPairs,
        interactiveTargets,
      };
    },
    { ratio: expansionRatio, rules: ignoreRules, helperFn: ignoreHelperSource }
  );

  const violations: IGeometricViolation[] = [];

  if (!snapshot.ignoreRootScrollLeak) {
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
