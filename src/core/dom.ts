/**
 * src/core/dom.ts
 * Unified DOM & Markup Integrity Gate (uirig dom).
 * Performs a read-only sweep across Light DOM, open ShadowRoots, and HTTP response
 * headers to catch structural AI hallucinations and passive security/prompt-injection traps,
 * with optional `--selectors` subtree scoping and Shadow DOM `<slot>` label resolution.
 */

import type { Page, Response } from 'playwright';
import type { IDomIntegrityViolation } from '../interfaces/locator.js';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
import { isElementInSelectorScope } from '../utils/scope.js';
import { createBrowserDomWalker } from '../utils/dom-walker.js';

export interface IDomAuditOptions {
  /** Optional HTTP navigation response used to verify frame-ancestors / X-Frame-Options headers. */
  navigationResponse?: Response | null;
  /** Optional runtime ignore rules from `uirig.config.json`. */
  ignoreRules?: IUirigIgnoreRule[];
  /** Optional CSS selectors limiting the DOM integrity sweep to matching subtrees. */
  selectors?: string[];
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
 * Runs the read-only Light + Shadow DOM integrity sweep against an active Playwright Page.
 */
export async function runDomIntegrityAudit(
  page: Page,
  options: IDomAuditOptions = {}
): Promise<IDomIntegrityViolation[]> {
  const ignoreRules = options.ignoreRules ?? [];
  const selectors = options.selectors;
  const isScopedAudit = Boolean(selectors && selectors.length > 0);

  logTelemetry(
    'dom:audit',
    'Running Light + Shadow DOM structural, media, and prompt-injection integrity sweep...'
  );

  const violations: IDomIntegrityViolation[] = [];

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
      walkerFactorySrc,
      ignoreHelperSrc,
      scopeHelperSrc,
    }: {
      rules: IUirigIgnoreRule[];
      activeSelectors?: string[];
      walkerFactorySrc: string;
      ignoreHelperSrc: string;
      scopeHelperSrc: string;
    }): IDomIntegrityViolation[] => {
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
      const found: IDomIntegrityViolation[] = [];

      const zeroWidthRegex = /[\u200B-\u200D\u2060\uFEFF]/;
      const formControlTags = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
      const ignoredInputTypes = new Set(['hidden', 'submit', 'reset', 'button', 'image']);

      function resolveIdInRoot(rootNode: Node, id: string): Element | null {
        if (rootNode instanceof Document || rootNode instanceof ShadowRoot) {
          return rootNode.getElementById(id);
        }
        return document.getElementById(id);
      }

      function hasDirectAriaOrLabel(el: Element): boolean {
        const ariaLabel = (el.getAttribute('aria-label') ?? '').trim();
        if (ariaLabel.length > 0) {
          return true;
        }
        const ariaLabelledBy = (el.getAttribute('aria-labelledby') ?? '').trim();
        if (ariaLabelledBy.length > 0) {
          return true;
        }
        const titleAttr = (el.getAttribute('title') ?? '').trim();
        if (titleAttr.length > 0) {
          return true;
        }
        if (el.closest('label')) {
          return true;
        }
        if (el.id) {
          const rootNode = el.getRootNode();
          const container =
            rootNode instanceof Document || rootNode instanceof ShadowRoot ? rootNode : document;
          if (container.querySelector(`label[for="${CSS.escape(el.id)}"]`)) {
            return true;
          }
        }
        return false;
      }

            function hasAccessibleLabel(el: Element): boolean {
        if (hasDirectAriaOrLabel(el)) {
          return true;
        }
        const rootNode = el.getRootNode();
        if (rootNode instanceof ShadowRoot && rootNode.host) {
          if (hasDirectAriaOrLabel(rootNode.host)) {
            return true;
          }
        }
        return false;
      }

      function hasSlottedAccessibleContent(el: Element): boolean {
        const slots = Array.from(el.querySelectorAll('slot'));
        for (const slot of slots) {
          const assigned = slot.assignedNodes({ flatten: true });
          for (const node of assigned) {
            if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0) {
              return true;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
              const assignedEl = node as Element;
              if ((assignedEl.textContent ?? '').trim().length > 0) {
                return true;
              }
              if (hasDirectAriaOrLabel(assignedEl)) {
                return true;
              }
            }
          }
        }
        return false;
      }

      walker.walkElements((el, meta) => {
        if (walker.isIgnored(el, 'dom')) {
          return;
        }

        const tag = el.tagName;
        const computed = window.getComputedStyle(el);
        const rootNode = el.getRootNode();

        // 1. Dangling ARIA ID references (`aria-labelledby`, `aria-describedby`)
        for (const ariaAttr of ['aria-labelledby', 'aria-describedby']) {
          const rawIds = (el.getAttribute(ariaAttr) ?? '').trim();
          if (rawIds.length > 0) {
            for (const idToken of rawIds.split(/\s+/)) {
              if (!resolveIdInRoot(rootNode, idToken)) {
                found.push({
                  rule: 'dangling_aria_ref',
                  selector: meta.selector,
                  hostComponent: meta.hostComponent,
                  detail: `Attribute ${ariaAttr}="${idToken}" references a missing element ID.`,
                  inShadowDom: meta.inShadowDom,
                });
              }
            }
          }
        }

        // 2. Dangling `<label for="...">` references
        if (tag === 'LABEL') {
          const forId = (el.getAttribute('for') ?? '').trim();
          if (forId.length > 0 && !resolveIdInRoot(rootNode, forId)) {
            found.push({
              rule: 'dangling_aria_ref',
              selector: meta.selector,
              hostComponent: meta.hostComponent,
              detail: `<label for="${forId}"> references a non-existent form control ID.`,
              inShadowDom: meta.inShadowDom,
            });
          }
        }

        // 3. Unlabeled form controls (`input`, `select`, `textarea`)
        if (formControlTags.has(tag)) {
          const inputType = (el.getAttribute('type') ?? 'text').toLowerCase();
          if (!ignoredInputTypes.has(inputType) && !hasAccessibleLabel(el)) {
            found.push({
              rule: 'unlabeled_control',
              selector: meta.selector,
              hostComponent: meta.hostComponent,
              detail: `<${tag.toLowerCase()}> lacks an associated <label>, aria-label, or aria-labelledby.`,
              inShadowDom: meta.inShadowDom,
            });
          }
        }

        // 4. Unlabeled icon-only `<button>` elements (checking direct text, slotted text, and host ARIA)
        if (tag === 'BUTTON') {
          const visibleText = (el.textContent ?? '').trim();
          if (
            visibleText.length === 0 &&
            !hasSlottedAccessibleContent(el) &&
            !hasAccessibleLabel(el)
          ) {
            found.push({
              rule: 'unlabeled_control',
              selector: meta.selector,
              hostComponent: meta.hostComponent,
              detail: '<button> has no visible text content and no aria-label or aria-labelledby.',
              inShadowDom: meta.inShadowDom,
            });
          }
        }

        // 5. Broken `<img>` elements (`complete === true && naturalWidth === 0`)
        if (tag === 'IMG') {
          const imgEl = el as HTMLImageElement;
          const src = (imgEl.getAttribute('src') ?? '').trim();
          if (src.length === 0 || (imgEl.complete && imgEl.naturalWidth === 0)) {
            found.push({
              rule: 'broken_image',
              selector: meta.selector,
              hostComponent: meta.hostComponent,
              detail: `Image failed to load or has empty src ('${src || 'missing'}').`,
              inShadowDom: meta.inShadowDom,
            });
          }
        }

        // 6. Unmuted `<video autoplay>` elements
        if (tag === 'VIDEO') {
          const videoEl = el as HTMLVideoElement;
          if (videoEl.autoplay && !videoEl.muted && !videoEl.hasAttribute('muted')) {
            found.push({
              rule: 'unmuted_autoplay',
              selector: meta.selector,
              hostComponent: meta.hostComponent,
              detail: '<video autoplay> is missing the muted attribute.',
              inShadowDom: meta.inShadowDom,
            });
          }
        }

        // 7. Passive link & URI hygiene (`javascript:` URIs and `target="_blank"` tabnabbing)
        if (tag === 'A') {
          const href = (el.getAttribute('href') ?? '').trim();
          if (/^javascript:/i.test(href)) {
            found.push({
              rule: 'unsafe_uri',
              selector: meta.selector,
              hostComponent: meta.hostComponent,
              detail: `Anchor uses unsafe executable URI scheme ('${href.slice(0, 32)}').`,
              inShadowDom: meta.inShadowDom,
            });
          }

          const targetAttr = (el.getAttribute('target') ?? '').toLowerCase();
          if (targetAttr === '_blank') {
            const relTokens = (el.getAttribute('rel') ?? '')
              .toLowerCase()
              .split(/\s+/)
              .filter(Boolean);
            if (!relTokens.includes('noopener')) {
              found.push({
                rule: 'unsafe_target_blank',
                selector: meta.selector,
                hostComponent: meta.hostComponent,
                detail: 'Anchor with target="_blank" is missing rel="noopener noreferrer".',
                inShadowDom: meta.inShadowDom,
              });
            }
          }
        }

        // 8. Hidden AI prompt-injection traps in direct text nodes
        let directText = '';
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            directText += child.textContent ?? '';
          }
        }
        const trimmedText = directText.trim();
        if (trimmedText.length > 0 && computed.display !== 'none' && computed.visibility !== 'hidden') {
          const fontSizePx = parseFloat(computed.fontSize);
          const hasZeroWidth = zeroWidthRegex.test(directText);
          const bg = computed.backgroundColor.trim();
          const isOpaqueSameColor =
            bg !== '' &&
            bg !== 'transparent' &&
            bg !== 'rgba(0, 0, 0, 0)' &&
            computed.color.trim() === bg;

          if (fontSizePx === 0 || hasZeroWidth || isOpaqueSameColor) {
            const reason =
              fontSizePx === 0
                ? 'font-size: 0px hidden text'
                : hasZeroWidth
                ? 'zero-width Unicode characters'
                : `foreground color matches opaque background (${bg})`;
            found.push({
              rule: 'prompt_injection_trap',
              selector: meta.selector,
              hostComponent: meta.hostComponent,
              detail: `Potential hidden prompt-injection text detected (${reason}).`,
              inShadowDom: meta.inShadowDom,
            });
          }
        }
      });

      return found;
    },
    {
      rules: ignoreRules,
      activeSelectors: selectors,
      walkerFactorySrc: createBrowserDomWalker.toString(),
      ignoreHelperSrc: isElementIgnoredInBrowser.toString(),
      scopeHelperSrc: isElementInSelectorScope.toString(),
    }
  );

  violations.push(...domViolations);

  const countBadge =
    violations.length > 0
      ? paint(String(violations.length), 'bold', 'red')
      : paint('0', 'bold', 'green');
  logTelemetry('dom:audit', `DOM integrity sweep complete. Violations detected: ${countBadge}`);

  return violations;
}
