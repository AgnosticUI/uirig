/**
 * src/core/dom.ts
 * Unified DOM & Markup Integrity Gate (uirig dom).
 * Performs a read-only sweep across Light DOM, open ShadowRoots, and HTTP response
 * headers to catch structural AI hallucinations (including orphaned Web Component
 * `<slot>` content) and passive security/prompt-injection traps, with optional
 * `--selectors` subtree scoping and Shadow DOM `<slot>` label resolution.
 */

import type { Page, Response } from 'playwright';
import type { IDomIntegrityViolation } from '../interfaces/locator.js';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
import { isElementInSelectorScope } from '../utils/scope.js';
import { createBrowserDomWalker } from '../utils/dom-walker.js';
import { auditComputedAccessibilityTree } from './ax-tree.js';

export interface IDomAuditOptions {
  /** Optional HTTP navigation response used to verify frame-ancestors / X-Frame-Options headers. */
  navigationResponse?: Response | null;
  /** Optional runtime ignore rules from `uirig.config.json`. */
  ignoreRules?: Array<IUirigIgnoreRule>;
  /** Optional CSS selectors limiting the DOM integrity sweep to matching subtrees (`--scope` / `--selectors`). */
  selectors?: Array<string>;
  /** Optional CSS selectors carved out from the DOM integrity sweep (`--exclude`). */
  excludeSelectors?: Array<string>;
}

/**
 * Pure helper that detects zero-width Unicode characters commonly used to smuggle
 * hidden prompt-injection instructions inside visible DOM text nodes.
 */
export function containsZeroWidthPromptCharacters(text: string): boolean {
  return /[\u200B-\u200D\u2060\uFEFF]/.test(text);
}

/**
 * Pure helper that audits HTTP response headers for clickjacking protection
 * (`X-Frame-Options` or `Content-Security-Policy` containing `frame-ancestors`).
 */
export function evaluateFrameProtectionHeaders(
  headers: Record<string, string>,
  pageUrl: string
): IDomIntegrityViolation | null {
  if (!/^https?:\/\//i.test(pageUrl)) {
    return null;
  }

  const normalizedHeaders: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = val;
  }

  const xfo = normalizedHeaders['x-frame-options'] ?? '';
  const csp = normalizedHeaders['content-security-policy'] ?? '';
  const hasXfo = xfo.trim().length > 0;
  const hasFrameAncestors = /frame-ancestors\s+/i.test(csp);

  if (!hasXfo && !hasFrameAncestors) {
    return {
      rule: 'missing_frame_header',
      selector: 'document',
      hostComponent: null,
      detail:
        'Response lacks X-Frame-Options or Content-Security-Policy frame-ancestors clickjacking protection.',
      inShadowDom: false,
    };
  }

  return null;
}

/**
 * Pure helper that checks whether a light-DOM child of a custom element (`<ag-card>`)
 * is orphaned because its `slot="..."` attribute does not match any `<slot>` inside the
 * host's `ShadowRoot` (or because no default `<slot>` exists for unslotted content).
 *
 * Returns a human-readable detail string when orphaned, or `null` when valid.
 */
export function describeOrphanedSlotReason(params: {
  hostTag: string;
  childTag: string;
  requestedSlot: string | null;
  namedSlots: ReadonlyArray<string>;
  hasDefaultSlot: boolean;
}): string | null {
  const { hostTag, childTag, requestedSlot, namedSlots, hasDefaultSlot } = params;
  const trimmedSlot = (requestedSlot ?? '').trim();

  // Valid case 1: Child targets a named slot that exists in the ShadowRoot.
  if (trimmedSlot.length > 0 && namedSlots.includes(trimmedSlot)) {
    return null;
  }

  // Valid case 2: Child has no `slot` attribute and a default unnamed `<slot>` exists.
  if (trimmedSlot.length === 0 && hasDefaultSlot) {
    return null;
  }

  // Format available slots for clear remediation guidance.
  const validSlotLabels = namedSlots.map((name) => `"${name}"`);
  if (hasDefaultSlot) {
    validSlotLabels.push('default (no slot attribute)');
  }

  if (validSlotLabels.length === 0) {
    const childPreview =
      trimmedSlot.length > 0 ? `<${childTag} slot="${trimmedSlot}">` : `<${childTag}>`;
    return `Orphaned light-DOM child ${childPreview} inside <${hostTag}>: <${hostTag}> defines no <slot> elements in its ShadowRoot.`;
  }

  const validSummary = `Valid slots: ${validSlotLabels.join(', ')}.`;
  if (trimmedSlot.length > 0) {
    return `Orphaned light-DOM child <${childTag} slot="${trimmedSlot}"> inside <${hostTag}>: slot "${trimmedSlot}" does not exist. ${validSummary}`;
  }

  return `Orphaned unslotted light-DOM child <${childTag}> inside <${hostTag}>: <${hostTag}> has no default unnamed <slot>. ${validSummary}`;
}

/**
 * Runs the read-only Light + Shadow DOM integrity sweep against an active Playwright Page.
 */
export async function runDomIntegrityAudit(
  page: Page,
  options: IDomAuditOptions = {}
): Promise<Array<IDomIntegrityViolation>> {
  const ignoreRules = options.ignoreRules ?? new Array<IUirigIgnoreRule>();
  const selectors = options.selectors;
  const excludeSelectors = options.excludeSelectors;
  const isScopedAudit = Boolean(selectors && selectors.length > 0);

  logTelemetry(
    'dom:audit',
    'Running Light + Shadow DOM structural, media, <slot>, and prompt-injection integrity sweep...'
  );

  const violations = new Array<IDomIntegrityViolation>();

  if (options.navigationResponse && !isScopedAudit) {
    const headerViolation = evaluateFrameProtectionHeaders(
      options.navigationResponse.headers(),
      page.url()
    );
    if (headerViolation) {
      violations.push(headerViolation);
    }
  }

  const domViolations = await page.evaluate(
    ({
      rules,
      activeSelectors,
      activeExcludes,
      walkerFactorySrc,
      ignoreHelperSrc,
      scopeHelperSrc,
    }: {
      rules: Array<IUirigIgnoreRule>;
      activeSelectors?: Array<string>;
      activeExcludes?: Array<string>;
      walkerFactorySrc: string;
      ignoreHelperSrc: string;
      scopeHelperSrc: string;
    }): Array<IDomIntegrityViolation> => {
      const buildWalker = new Function(
        `return (${walkerFactorySrc});`
      )() as typeof createBrowserDomWalker;
      const walker = buildWalker(
        window.location.href,
        rules,
        ignoreHelperSrc,
        activeSelectors,
        scopeHelperSrc,
        activeExcludes
      );
      const found = new Array<IDomIntegrityViolation>();
      return found;
    },
    {
      rules: ignoreRules,
      activeSelectors: selectors,
      activeExcludes: excludeSelectors,
      walkerFactorySrc: createBrowserDomWalker.toString(),
      ignoreHelperSrc: isElementIgnoredInBrowser.toString(),
      scopeHelperSrc: isElementInSelectorScope.toString(),
    }
  );

  violations.push(...domViolations);

  const axViolations = await auditComputedAccessibilityTree(page, {
    ignoreRules,
    selectors,
    excludeSelectors,
  });

  const existingUnlabeledSelectors = new Set(
    violations
      .filter((v) => v.rule === 'unlabeled_control')
      .map((v) => v.selector)
  );

  for (const axViolation of axViolations) {
    if (
      axViolation.rule === 'ax_empty_name' &&
      existingUnlabeledSelectors.has(axViolation.selector)
    ) {
      continue;
    }
    violations.push(axViolation);
  }

  const countBadge =
    violations.length > 0
      ? paint(String(violations.length), 'bold', 'red')
      : paint('0', 'bold', 'green');
  logTelemetry('dom:audit', `DOM integrity sweep complete. Violations detected: ${countBadge}`);

  return violations;
}
