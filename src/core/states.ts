/**
 * src/core/states.ts
 * Interactive State & Click-Occlusion Verification Engine (`uirig states`).
 * Evaluates:
 * 1. Click-occlusion math (`click_occluded`) via Shadow-DOM-piercing `elementsFromPoint(x, y)`
 *    on viewport- and overflow-clipped interactive controls.
 * 2. Keyboard focus indicator parity (`missing_focus_visible`) via Chromium CDP
 *    `CSS.forcePseudoState(['focus-visible'])` computed style deltas.
 */

import type { Page } from 'playwright';
import type { IInteractiveStateViolation } from '../interfaces/locator.js';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
import { isElementInSelectorScope } from '../utils/scope.js';
import { createBrowserDomWalker } from '../utils/dom-walker.js';

export interface IInteractiveStatesAuditOptions {
  /** Optional runtime ignore rules from `uirig.config.json`. */
  ignoreRules?: Array<IUirigIgnoreRule>;
  /** Optional CSS selectors scoping checks to matching subtrees (`--scope` / `--selectors`). */
  selectors?: Array<string>;
  /** Optional CSS selectors carved out from checks (`--exclude`). */
  excludeSelectors?: Array<string>;
}

export interface IFocusIndicatorStyleSnapshot {
  outlineStyle: string;
  outlineWidth: string;
  outlineColor: string;
  outlineOffset: string;
  boxShadow: string;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  borderTopWidth: string;
  borderRightWidth: string;
  borderBottomWidth: string;
  borderLeftWidth: string;
  backgroundColor: string;
  color: string;
  textDecorationLine: string;
}

export interface IClipRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ISampledPoint {
  label: 'center' | 'top-left' | 'bottom-right';
  x: number;
  y: number;
}

/**
 * Pure helper that checks whether forcing `:focus-visible` produced any measurable
 * visual focus indicator delta compared to the element's resting computed styles.
 */
export function hasVisibleFocusIndicatorDelta(
  rest: IFocusIndicatorStyleSnapshot,
  focused: IFocusIndicatorStyleSnapshot
): boolean {
  const focusOutlineWidthPx = Number.parseFloat(focused.outlineWidth) || 0;
  const hasVisibleFocusOutline =
    focused.outlineStyle !== 'none' &&
    focusOutlineWidthPx > 0 &&
    focused.outlineColor !== 'transparent' &&
    focused.outlineColor !== 'rgba(0, 0, 0, 0)';

  if (
    hasVisibleFocusOutline &&
    (rest.outlineStyle !== focused.outlineStyle ||
      rest.outlineWidth !== focused.outlineWidth ||
      rest.outlineColor !== focused.outlineColor ||
      rest.outlineOffset !== focused.outlineOffset)
  ) {
    return true;
  }

  if (focused.boxShadow !== 'none' && rest.boxShadow !== focused.boxShadow) {
    return true;
  }

  const borderChanged =
    rest.borderTopColor !== focused.borderTopColor ||
    rest.borderRightColor !== focused.borderRightColor ||
    rest.borderBottomColor !== focused.borderBottomColor ||
    rest.borderLeftColor !== focused.borderLeftColor ||
    rest.borderTopWidth !== focused.borderTopWidth ||
    rest.borderRightWidth !== focused.borderRightWidth ||
    rest.borderBottomWidth !== focused.borderBottomWidth ||
    rest.borderLeftWidth !== focused.borderLeftWidth;

  if (borderChanged) {
    return true;
  }

  if (
    rest.backgroundColor !== focused.backgroundColor ||
    rest.color !== focused.color ||
    rest.textDecorationLine !== focused.textDecorationLine
  ) {
    return true;
  }

  return false;
}

/**
 * Intersects a control's bounding rectangle with all ancestor overflow-clipping containers
 * and the active viewport `[0..viewportWidth, 0..viewportHeight]`.
 * Returns `null` when the control is completely off-screen or clipped (`width <= 0` or `height <= 0`).
 */
export function computeClippedViewportRect(
  targetRect: IClipRect,
  clipAncestors: ReadonlyArray<IClipRect>,
  viewportWidth: number,
  viewportHeight: number
): IClipRect | null {
  let left = Math.max(0, targetRect.left);
  let top = Math.max(0, targetRect.top);
  let right = Math.min(viewportWidth, targetRect.right);
  let bottom = Math.min(viewportHeight, targetRect.bottom);

  for (const clip of clipAncestors) {
    left = Math.max(left, clip.left);
    top = Math.max(top, clip.top);
    right = Math.min(right, clip.right);
    bottom = Math.min(bottom, clip.bottom);
  }

  if (right - left < 1 || bottom - top < 1) {
    return null;
  }

  return { left, top, right, bottom };
}

/**
 * Generates safe hit-test sample points inside a clipped visible rectangle:
 * center `(50%, 50%)` plus safely inset `(25%, 25%)` and `(75%, 75%)` coordinates
 * that avoid rounded pill corners (`border-radius: 999px`).
 */
export function computeSafeSamplePoints(rect: IClipRect): Array<ISampledPoint> {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (width < 1 || height < 1) {
    return new Array<ISampledPoint>();
  }

  const center: ISampledPoint = {
    label: 'center',
    x: Math.round((rect.left + width * 0.5) * 100) / 100,
    y: Math.round((rect.top + height * 0.5) * 100) / 100,
  };

  if (width < 12 || height < 12) {
    return [center];
  }

  return [
    center,
    {
      label: 'top-left',
      x: Math.round((rect.left + width * 0.25) * 100) / 100,
      y: Math.round((rect.top + height * 0.25) * 100) / 100,
    },
    {
      label: 'bottom-right',
      x: Math.round((rect.left + width * 0.75) * 100) / 100,
      y: Math.round((rect.top + height * 0.75) * 100) / 100,
    },
  ];
}
/**
 * Evaluates live click-occlusion across Light DOM, nested open ShadowRoots, and same-origin
 * iframes by sampling center and inset coordinates via `elementsFromPoint(x, y)`.
 */
export async function collectClickOcclusionViolations(
  page: Page,
  options: IInteractiveStatesAuditOptions = {}
): Promise<Array<IInteractiveStateViolation>> {
  const ignoreRules = options.ignoreRules ?? new Array<IUirigIgnoreRule>();
  const selectors = options.selectors;
  const excludeSelectors = options.excludeSelectors;

  return await page.evaluate(
    ({
      rules,
      activeSelectors,
      activeExcludes,
      walkerFactorySrc,
      ignoreHelperSrc,
      scopeHelperSrc,
      clipHelperSrc,
      sampleHelperSrc,
    }: {
      rules: Array<IUirigIgnoreRule>;
      activeSelectors?: Array<string>;
      activeExcludes?: Array<string>;
      walkerFactorySrc: string;
      ignoreHelperSrc: string;
      scopeHelperSrc: string;
      clipHelperSrc: string;
      sampleHelperSrc: string;
    }): Array<IInteractiveStateViolation> => {
      const buildWalker = new Function(
        `return (${walkerFactorySrc});`
      )() as typeof createBrowserDomWalker;
      const clipRectFn = new Function(
        `return (${clipHelperSrc});`
      )() as typeof computeClippedViewportRect;
      const samplePointsFn = new Function(
        `return (${sampleHelperSrc});`
      )() as typeof computeSafeSamplePoints;

      const walker = buildWalker(
        window.location.href,
        rules,
        ignoreHelperSrc,
        activeSelectors,
        scopeHelperSrc,
        activeExcludes
      );

      const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
      const interactiveRoles = new Set([
        'button',
        'link',
        'tab',
        'menuitem',
        'checkbox',
        'radio',
        'switch',
        'combobox',
      ]);

      function isInteractiveControl(el: Element): boolean {
        const tag = el.tagName;
        if (tag === 'AREA') {
          return false;
        }
        if (tag === 'INPUT' && (el.getAttribute('type') ?? '').toLowerCase() === 'hidden') {
          return false;
        }
        if (tag === 'A' && !el.hasAttribute('href')) {
          return false;
        }
        if (interactiveTags.has(tag)) {
          return true;
        }
        const role = (el.getAttribute('role') ?? '').trim().toLowerCase();
        if (interactiveRoles.has(role)) {
          return true;
        }
        const tabIndexAttr = el.getAttribute('tabindex');
        if (tabIndexAttr !== null) {
          const parsed = Number.parseInt(tabIndexAttr, 10);
          if (Number.isFinite(parsed) && parsed >= 0) {
            return true;
          }
        }
        return false;
      }

      function isControlEligibleForHitTest(el: Element): boolean {
        if (
          el.hasAttribute('disabled') ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.closest('[aria-hidden="true"], [inert]') ||
          walker.isVisuallyHidden(el)
        ) {
          return false;
        }
        const computed = window.getComputedStyle(el);
        if (
          computed.display === 'none' ||
          computed.visibility === 'hidden' ||
          computed.visibility === 'collapse' ||
          computed.pointerEvents === 'none'
        ) {
          return false;
        }
        return true;
      }

      function getComposedParent(el: Element): Element | null {
        if (el.assignedSlot) {
          return el.assignedSlot;
        }
        if (el.parentElement) {
          return el.parentElement;
        }
        const root = el.getRootNode();
        return root instanceof ShadowRoot ? root.host : null;
      }

      function collectOverflowClipRects(el: Element): Array<IClipRect> {
        const clips = new Array<IClipRect>();
        let cursor = getComposedParent(el);
        while (cursor && cursor.tagName !== 'HTML' && cursor.tagName !== 'BODY') {
          const style = window.getComputedStyle(cursor);
          const clipsX =
            style.overflowX === 'hidden' ||
            style.overflowX === 'clip' ||
            style.overflowX === 'scroll' ||
            style.overflowX === 'auto';
          const clipsY =
            style.overflowY === 'hidden' ||
            style.overflowY === 'clip' ||
            style.overflowY === 'scroll' ||
            style.overflowY === 'auto';
          if (clipsX || clipsY) {
            const r = cursor.getBoundingClientRect();
            clips.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
          }
          cursor = getComposedParent(cursor);
        }
        return clips;
      }
      function resolveDeepestHitElement(doc: Document, x: number, y: number): Element | null {
        const topList = doc.elementsFromPoint(x, y);
        let hit: Element | null = topList.at(0) ?? null;
        const visitedRoots = new Set<ShadowRoot>();

        while (hit && hit.shadowRoot && !visitedRoots.has(hit.shadowRoot)) {
          visitedRoots.add(hit.shadowRoot);
          const shadowHits = hit.shadowRoot.elementsFromPoint(x, y);
          const nextHit = shadowHits.find((candidate) => candidate !== hit) ?? null;
          if (!nextHit) {
            break;
          }
          hit = nextHit;
        }

        return hit;
      }

      function formatShadowBreadcrumb(el: Element): string {
        const segments = new Array<string>();
        let cursor: Element | null = el;

        while (cursor) {
          const tag = cursor.tagName.toLowerCase();
          const testId = cursor.getAttribute('data-testid');
          let label = tag;
          if (cursor.id) {
            label = `${tag}#${cursor.id}`;
          } else if (testId) {
            label = `${tag}[data-testid="${testId}"]`;
          } else if (typeof cursor.className === 'string' && cursor.className.trim().length > 0) {
            label = `${tag}.${cursor.className.trim().split(/\s+/).slice(0, 2).join('.')}`;
          }
          segments.unshift(label);

          if (cursor.parentElement) {
            cursor = cursor.parentElement;
          } else {
            const root = cursor.getRootNode();
            if (root instanceof ShadowRoot && root.host) {
              segments.unshift('shadow-root');
              cursor = root.host;
            } else {
              cursor = null;
            }
          }
        }

        return segments.slice(-4).join(' >> ');
      }

      function isHitAuthorizedForControl(hit: Element, control: Element): boolean {
        let cursor: Element | null = hit;
        const controlId = control.id;
        const controlRoot = control.getRootNode();

        while (cursor) {
          if (cursor === control) {
            return true;
          }
          if (cursor.tagName === 'LABEL') {
            if (cursor.contains(control)) {
              return true;
            }
            const htmlFor = (cursor as HTMLLabelElement).htmlFor;
            if (controlId && htmlFor === controlId && cursor.getRootNode() === controlRoot) {
              return true;
            }
          }
          cursor = getComposedParent(cursor);
        }

        return false;
      }

      const violations = new Array<IInteractiveStateViolation>();

      walker.walkElements(
        (el, meta) => {
          if (
            !isInteractiveControl(el) ||
            !isControlEligibleForHitTest(el) ||
            walker.isIgnored(el, 'states')
          ) {
            return;
          }

          const rawRect = el.getBoundingClientRect();
          if (rawRect.width <= 0 || rawRect.height <= 0) {
            return;
          }

          const clipped = clipRectFn(
            {
              left: rawRect.left,
              top: rawRect.top,
              right: rawRect.right,
              bottom: rawRect.bottom,
            },
            collectOverflowClipRects(el),
            window.innerWidth,
            window.innerHeight
          );
          if (!clipped) {
            return;
          }

          const samplePoints = samplePointsFn(clipped);
          for (const pt of samplePoints) {
            let hit = resolveDeepestHitElement(document, pt.x, pt.y);
            if (hit && hit.tagName === 'IFRAME') {
              try {
                const iframeEl = hit as HTMLIFrameElement;
                const iframeDoc = iframeEl.contentDocument;
                if (iframeDoc) {
                  const iframeRect = iframeEl.getBoundingClientRect();
                  const innerHit = resolveDeepestHitElement(
                    iframeDoc,
                    pt.x - iframeRect.left,
                    pt.y - iframeRect.top
                  );
                  if (innerHit) {
                    hit = innerHit;
                  }
                }
              } catch {
                // Cross-origin iframe itself is the occluding element
              }
            }

            if (hit && !isHitAuthorizedForControl(hit, el)) {
              const occludingSelector = formatShadowBreadcrumb(hit);
              violations.push({
                violationType: 'click_occluded',
                selector: meta.selector,
                hostComponent: meta.hostComponent,
                occludingSelector,
                detail: `Interactive control '${meta.selector}' is occluded at (${pt.x}, ${pt.y}) by '${occludingSelector}'.`,
                inShadowDom: meta.inShadowDom,
              });
              break;
            }
          }
        },
        { includeBody: false }
      );

      return violations;
    },
    {
      rules: ignoreRules,
      activeSelectors: selectors,
      activeExcludes: excludeSelectors,
      walkerFactorySrc: createBrowserDomWalker.toString(),
      ignoreHelperSrc: isElementIgnoredInBrowser.toString(),
      scopeHelperSrc: isElementInSelectorScope.toString(),
      clipHelperSrc: computeClippedViewportRect.toString(),
      sampleHelperSrc: computeSafeSamplePoints.toString(),
    }
  );
}

interface IFocusCandidateMeta {
  index: number;
  selector: string;
  hostComponent: string | null;
  inShadowDom: boolean;
}

/**
 * Uses Chromium CDP `CSS.forcePseudoState(['focus-visible'])` to verify that every
 * keyboard-focusable interactive control exhibits a measurable visual focus ring delta
 * across Light DOM and open ShadowRoots.
 */
export async function collectMissingFocusVisibleViolations(
  page: Page,
  options: IInteractiveStatesAuditOptions = {}
): Promise<Array<IInteractiveStateViolation>> {
  const ignoreRules = options.ignoreRules ?? new Array<IUirigIgnoreRule>();
  const selectors = options.selectors;
  const excludeSelectors = options.excludeSelectors;

  const candidates = await page.evaluate(
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
    }): Array<IFocusCandidateMeta> => {
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

      const stored = new Array<Element>();
      const metas = new Array<IFocusCandidateMeta>();
      (window as unknown as Record<string, unknown>).__uirigFocusCandidates = stored;

      const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
      const interactiveRoles = new Set([
        'button',
        'link',
        'tab',
        'menuitem',
        'checkbox',
        'radio',
        'switch',
        'combobox',
      ]);

      function isFocusableControl(el: Element): boolean {
        if (
          el.tagName === 'AREA' ||
          el.hasAttribute('disabled') ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.closest('[aria-hidden="true"], [inert]') ||
          walker.isVisuallyHidden(el)
        ) {
          return false;
        }
        if (el.tagName === 'INPUT' && (el.getAttribute('type') ?? '').toLowerCase() === 'hidden') {
          return false;
        }
        if (el.tagName === 'A' && !el.hasAttribute('href')) {
          return false;
        }
        const computed = window.getComputedStyle(el);
        if (
          computed.display === 'none' ||
          computed.visibility === 'hidden' ||
          computed.visibility === 'collapse'
        ) {
          return false;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return false;
        }
        const tabIndexAttr = el.getAttribute('tabindex');
        if (tabIndexAttr !== null) {
          const parsed = Number.parseInt(tabIndexAttr, 10);
          return Number.isFinite(parsed) && parsed >= 0;
        }
        if (interactiveTags.has(el.tagName)) {
          return true;
        }
        const role = (el.getAttribute('role') ?? '').trim().toLowerCase();
        return interactiveRoles.has(role);
      }

      walker.walkElements(
        (el, meta) => {
          if (!isFocusableControl(el) || walker.isIgnored(el, 'states')) {
            return;
          }
          // Skip custom element host if it delegates focus to an inner ShadowRoot control
          if (el.tagName.includes('-') && el.shadowRoot) {
            const innerFocusable = el.shadowRoot.querySelector(
              'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (innerFocusable) {
              return;
            }
          }
          const idx = stored.length;
          stored.push(el);
          metas.push({
            index: idx,
            selector: meta.selector,
            hostComponent: meta.hostComponent,
            inShadowDom: meta.inShadowDom,
          });
        },
        { includeBody: false }
      );

      return metas;
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
  if (candidates.length === 0) {
    await page
      .evaluate(() => {
        delete (window as unknown as Record<string, unknown>).__uirigFocusCandidates;
      })
      .catch(() => {});
    return new Array<IInteractiveStateViolation>();
  }

  const violations = new Array<IInteractiveStateViolation>();
  const cdp = await page.context().newCDPSession(page);

  const readStyleSnapshot = async (idx: number): Promise<IFocusIndicatorStyleSnapshot | null> => {
    return await page.evaluate((candidateIdx: number): IFocusIndicatorStyleSnapshot | null => {
      const list = (window as unknown as Record<string, unknown>).__uirigFocusCandidates as
        | Array<Element>
        | undefined;
      const el = list?.at(candidateIdx);
      if (!el) {
        return null;
      }
      const s = window.getComputedStyle(el);
      return {
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
        outlineColor: s.outlineColor,
        outlineOffset: s.outlineOffset,
        boxShadow: s.boxShadow,
        borderTopColor: s.borderTopColor,
        borderRightColor: s.borderRightColor,
        borderBottomColor: s.borderBottomColor,
        borderLeftColor: s.borderLeftColor,
        borderTopWidth: s.borderTopWidth,
        borderRightWidth: s.borderRightWidth,
        borderBottomWidth: s.borderBottomWidth,
        borderLeftWidth: s.borderLeftWidth,
        backgroundColor: s.backgroundColor,
        color: s.color,
        textDecorationLine: s.textDecorationLine,
      };
    }, idx);
  };

  try {
    await cdp.send('DOM.enable');
    await cdp.send('DOM.getDocument', { depth: 0 });
    await cdp.send('CSS.enable');

    for (const candidate of candidates) {
      const restSnapshot = await readStyleSnapshot(candidate.index);
      if (!restSnapshot) {
        continue;
      }

      const evalObj = (await cdp.send('Runtime.evaluate', {
        expression: `window.__uirigFocusCandidates[${candidate.index}]`,
        returnByValue: false,
      })) as { result?: { objectId?: string } };
      const objectId = evalObj.result?.objectId;
      if (!objectId) {
        continue;
      }

      let nodeId: number | undefined;
      try {
        const requested = (await cdp.send('DOM.requestNode', { objectId })) as {
          nodeId?: number;
        };
        nodeId = requested.nodeId;
      } finally {
        await cdp.send('Runtime.releaseObject', { objectId }).catch(() => {});
      }

      if (!nodeId || nodeId <= 0) {
        continue;
      }

      try {
        await cdp.send('CSS.forcePseudoState', {
          nodeId,
          forcedPseudoClasses: ['focus-visible'],
        });
        const focusedSnapshot = await readStyleSnapshot(candidate.index);
        if (focusedSnapshot && !hasVisibleFocusIndicatorDelta(restSnapshot, focusedSnapshot)) {
          violations.push({
            violationType: 'missing_focus_visible',
            selector: candidate.selector,
            hostComponent: candidate.hostComponent,
            detail: `Interactive control '${candidate.selector}' produces zero visual style change under :focus-visible (missing focus ring).`,
            inShadowDom: candidate.inShadowDom,
          });
        }
      } finally {
        await cdp
          .send('CSS.forcePseudoState', {
            nodeId,
            forcedPseudoClasses: [],
          })
          .catch(() => {});
      }
    }
  } finally {
    await cdp.detach().catch(() => {});
    await page
      .evaluate(() => {
        delete (window as unknown as Record<string, unknown>).__uirigFocusCandidates;
      })
      .catch(() => {});
  }

  return violations;
}

/**
 * Runs the full interactive state & click-occlusion verification gate (`uirig states`).
 */
export async function runInteractiveStatesAudit(
  page: Page,
  options: IInteractiveStatesAuditOptions = {}
): Promise<Array<IInteractiveStateViolation>> {
  logTelemetry(
    'states:audit',
    'Auditing interactive controls for click-occlusion and :focus-visible indicator parity...'
  );

  const occlusionViolations = await collectClickOcclusionViolations(page, options);
  const focusViolations = await collectMissingFocusVisibleViolations(page, options);
  const violations = [...occlusionViolations, ...focusViolations];

  const countBadge =
    violations.length > 0
      ? paint(String(violations.length), 'bold', 'red')
      : paint('0', 'bold', 'green');
  logTelemetry(
    'states:audit',
    `Interactive states audit complete. Violations detected: ${countBadge}`
  );

  return violations;
}
