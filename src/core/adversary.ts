/**
 * src/core/adversary.ts
 * Geometric Invariant Overflow Rig (uirig stress).
 * Evaluates parent-child containment bounds, viewport horizontal scrollbar leaks,
 * and interactive touch-target spacing invariants using Euclidean box math.
 */

/**
 * Axis-aligned bounding box coordinates matching browser `DOMRect` geometry.
 *
 * Layout-Model Agnostic Design:
 * Because these coordinates originate from the browser's post-layout `getBoundingClientRect()` API,
 * all geometric invariant checks work identically regardless of whether elements are positioned
 * via normal flow (`static`), `relative`, `absolute`, `fixed`, Flexbox, or CSS Grid.
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
 * Checks whether a child element's right or bottom edge breaches its parent container's
 * bounding box beyond `overflowPixelTolerance`.
 *
 * Works across all CSS positioning schemes (`static`, `relative`, `absolute`, Flexbox, Grid)
 * because `getBoundingClientRect()` resolves final 2D screen coordinates after layout calculation.
 * (Note: When crawling live DOM trees, floating `position: fixed` overlays/modals should be
 * excluded from parent-containment checks since they intentionally escape document flow.)
 *
 * @param parent - Bounding box of the containing parent element.
 * @param child - Bounding box of the nested child element.
 * @param overflowPixelTolerance - Allowed sub-pixel rounding buffer in pixels (default 2px).
 * @returns An `IGeometricViolation` if breached, or `null` if safely contained.
 */
export function checkParentChildOverflow(
  parent: IBoundingBox,
  child: IBoundingBox,
  overflowPixelTolerance: number = 2
): IGeometricViolation | null {
  // Compute right and bottom edges for both parent and child rectangles
  const parentRight = parent.x + parent.width;
  const parentBottom = parent.y + parent.height;
  const childRight = child.x + child.width;
  const childBottom = child.y + child.height;

  // Measure positive overflow on each axis (0 if child fits inside parent)
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
 *
 * @param documentScrollWidth - `document.documentElement.scrollWidth` in pixels.
 * @param windowInnerWidth - `window.innerWidth` in pixels.
 * @param overflowPixelTolerance - Allowed sub-pixel rounding buffer in pixels (default 2px).
 * @returns An `IGeometricViolation` if horizontal bleed occurs, or `null` if clean.
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
 *
 * @param targetA - First interactive control bounding box.
 * @param targetB - Second interactive control bounding box.
 * @param touchTargetMinSpacingPx - Minimum required edge-to-edge clearance (default 24px).
 * @returns An `IGeometricViolation` if overlapping or crowded, or `null` if safe.
 */
export function checkTouchTargetSpacing(
  targetA: IBoundingBox,
  targetB: IBoundingBox,
  touchTargetMinSpacingPx: number = 24
): IGeometricViolation | null {
  // Compute signed horizontal and vertical edge-to-edge distances between rectangles.
  // Positive values mean separated by a gap; negative values mean overlapping on that axis.
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
