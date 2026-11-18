/**
 * src/utils/root-cause-grouper.ts
 * Parent Container Violation Grouper (`--group-by-root`, Issue #11).
 *
 * What this file does:
 * Collapses multiple child violations that share the same enclosing Web Component
 * host or parent container (and same defect type/surface) into a single root-cause
 * violation with `childCount` and up to 3 `sampleChildren` selectors.
 */

import type { IAgenticViolation } from './agent-stream.js';
import { logTelemetry } from './formatter.js';

/** Maximum number of sample child selectors attached to a grouped parent violation. */
export const MAX_SAMPLE_CHILDREN = 3;

/**
 * Extracts the enclosing Web Component host or immediate parent container selector
 * from a full DOM / Shadow DOM selector path.
 *
 * Examples:
 * - `"ag-card#pro >> shadow-root >> div.body > p.subtitle"` -> `"ag-card#pro"`
 * - `"div.pricing-grid > div.card > span.price"` -> `"div.pricing-grid > div.card"`
 * - `"button.lonely"` -> `"button.lonely"`
 */
export function extractParentContainerSelector(
  selector: string,
  hostComponent: string | null = null
): string {
  const trimmed = selector.trim();
  if (!trimmed) {
    return hostComponent ?? 'document';
  }

  // Rule A: If inside a Web Component ShadowRoot, promote to the enclosing host selector.
  const shadowIndex = trimmed.indexOf('>> shadow-root >>');
  if (shadowIndex > 0) {
    return trimmed.slice(0, shadowIndex).trim();
  }

  // Rule B: If a custom element hostComponent is explicitly known, use it as the root container.
  if (hostComponent && hostComponent.trim().length > 0) {
    return hostComponent.trim();
  }

  // Rule C: For standard Light DOM paths (`parent > child`), extract everything before the last ` > `.
  const lastChildCombinator = trimmed.lastIndexOf(' > ');
  if (lastChildCombinator > 0) {
    return trimmed.slice(0, lastChildCombinator).trim();
  }

  return trimmed;
}

/**
 * Extracts a shared surface or CSS property fingerprint so violations caused by
 * different background colors or different CSS properties inside the same parent
 * container stay separate instead of being merged together.
 */
function extractSharedCauseFingerprint(violation: IAgenticViolation): string {
  // Check both measuredDelta and remediationAdvice for background color (`background (rgb(...))` or `on bg rgb(...)`).
  const combinedText = `${violation.measuredDelta} ${violation.remediationAdvice}`;
  const bgMatch = combinedText.match(
    /(?:background\s*\(|on\s+bg\s+)(rgba?\([^)]+\))/i
  );
  const capturedBg = bgMatch?.at(1);
  if (capturedBg) {
    return `bg:${capturedBg.toLowerCase()}`;
  }

  // For token drift, include the CSS property name (`color: ...`, `backgroundColor: ...`).
  if (violation.engine === 'tokens') {
    const colonIdx = violation.measuredDelta.indexOf(':');
    if (colonIdx > 0) {
      return `prop:${violation.measuredDelta.slice(0, colonIdx).trim()}`;
    }
  }

  return violation.violationType;
}

/**
 * Groups cascading child violations under their shared parent container or
 * Web Component host when 2 or more children fail for the same underlying cause.
 *
 * Single-child failures (`count === 1`) are returned untouched.
 */
export function groupViolationsByRootCause(
  violations: ReadonlyArray<IAgenticViolation>
): Array<IAgenticViolation> {
  if (violations.length <= 1) {
    return Array.from(violations);
  }

  interface GroupBucket {
    parentSelector: string;
    items: Array<IAgenticViolation>;
  }

  const buckets = new Map<string, GroupBucket>();

  for (const item of violations) {
    const parentSelector = extractParentContainerSelector(
      item.selector,
      item.hostComponent
    );
    const causeFingerprint = extractSharedCauseFingerprint(item);

    const groupKey = [
      item.url,
      item.viewport,
      item.engine,
      item.violationType,
      parentSelector,
      causeFingerprint,
    ].join('::');

    const existing = buckets.get(groupKey);
    if (!existing) {
      buckets.set(groupKey, {
        parentSelector,
        items: [item],
      });
    } else {
      existing.items.push(item);
    }
  }

  const groupedOutput = new Array<IAgenticViolation>();
  let totalCollapsedChildren = 0;

  for (const bucket of buckets.values()) {
    const firstItem = bucket.items.at(0);
    if (!firstItem) {
      continue;
    }

    if (bucket.items.length === 1) {
      groupedOutput.push(firstItem);
      continue;
    }

    const childCount = bucket.items.length;
    totalCollapsedChildren += childCount;

    const sampleChildren = new Array<string>();
    for (const child of bucket.items) {
      if (!sampleChildren.includes(child.selector) && sampleChildren.length < MAX_SAMPLE_CHILDREN) {
        sampleChildren.push(child.selector);
      }
    }

    const rootAdvice = `Root cause in '${bucket.parentSelector}' (${childCount} child elements affected): ${firstItem.remediationAdvice}`;

    groupedOutput.push({
      ...firstItem,
      selector: bucket.parentSelector,
      childCount,
      sampleChildren,
      remediationAdvice: rootAdvice,
    });
  }

  if (totalCollapsedChildren > 0) {
    logTelemetry(
      'grouper:root-cause',
      `Collapsed ${totalCollapsedChildren} child violations into ${groupedOutput.length} root-cause entries`
    );
  }

  return groupedOutput;
}
