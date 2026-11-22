/**
 * src/core/ax-tree.ts
 * Computed Accessibility Tree Snapshot Engine (Issue #19).
 * Evaluates Chromium CDP (Chrome DevTools Protocol) `Accessibility.getFullAXTree` nodes for:
 * - `ax_empty_name`: interactive AX (Accessibility) roles whose computed accessible name is empty/whitespace.
 * - `ax_hidden_focus`: keyboard-focusable controls nested inside `aria-hidden="true"` or `inert` ancestors.
 */

import type { Page } from 'playwright';
import type { IDomIntegrityViolation } from '../interfaces/locator.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
import { isElementInSelectorScope } from '../utils/scope.js';

export interface ICdpAxValue {
  type?: string;
  value?: unknown;
}

export interface ICdpAxProperty {
  name: string;
  value: ICdpAxValue;
}

export interface ICdpAxNode {
  nodeId: string;
  ignored?: boolean;
  ignoredReasons?: Array<ICdpAxProperty>;
  role?: ICdpAxValue;
  name?: ICdpAxValue;
  properties?: Array<ICdpAxProperty>;
  childIds?: Array<string>;
  parentId?: string;
  backendDOMNodeId?: number;
}

export interface IAxTreeAuditOptions {
  /** Optional runtime ignore rules from `uirig.config.json`. */
  ignoreRules?: Array<IUirigIgnoreRule>;
  /** Optional CSS (Cascading Style Sheets) selectors limiting the AX sweep to matching subtrees. */
  selectors?: Array<string>;
}

interface IResolvedDomTargetMetadata {
  ignored: boolean;
  inScope: boolean;
  selector: string;
  hostComponent: string | null;
  inShadowDom: boolean;
  hasHiddenOrInertDomAncestor: boolean;
}

/**
 * Interactive WAI-ARIA (Web Accessibility Initiative - Accessible Rich Internet Applications)
 * and Chromium AX roles that MUST expose a non-empty computed accessible name.
 */
export const INTERACTIVE_AX_ROLES = new Set<string>([
  'button',
  'link',
  'textbox',
  'combobox',
  'checkbox',
  'radio',
  'tab',
  'menuitem',
]);

/**
 * Reads a boolean property (such as `focusable` or `hidden`) from a CDP `AXNode.properties` list.
 */
export function getAxBooleanProperty(node: ICdpAxNode, propertyName: string): boolean {
  if (!Array.isArray(node.properties)) {
    return false;
  }
  for (const prop of node.properties) {
    if (prop.name === propertyName && prop.value?.value === true) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a CDP `AXNode` is keyboard-focusable (`focusable: true` or `focused: true`).
 */
export function isAxNodeFocusable(node: ICdpAxNode): boolean {
  return getAxBooleanProperty(node, 'focusable') || getAxBooleanProperty(node, 'focused');
}

/**
 * Checks whether a CDP `AXNode` was ignored due to an `aria-hidden` or `inert` ancestor/attribute.
 */
export function isAxNodeHiddenByAriaOrInert(node: ICdpAxNode): boolean {
  if (getAxBooleanProperty(node, 'hidden')) {
    return true;
  }
  if (Array.isArray(node.ignoredReasons)) {
    for (const reason of node.ignoredReasons) {
      if (
        reason.name === 'ariaHiddenElement' ||
        reason.name === 'ariaHiddenSubtree' ||
        reason.name === 'inertElement' ||
        reason.name === 'inertSubtree'
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Evaluates a single non-ignored CDP `AXNode` for `ax_empty_name`.
 * Returns a human-readable detail message if the node has an interactive role with an empty
 * or whitespace-only computed accessible name, or `null` when valid.
 */
export function evaluateAxNodeForEmptyName(node: ICdpAxNode): string | null {
  if (node.ignored === true || typeof node.backendDOMNodeId !== 'number') {
    return null;
  }

  const rawRole = typeof node.role?.value === 'string' ? node.role.value.trim().toLowerCase() : '';
  if (!INTERACTIVE_AX_ROLES.has(rawRole)) {
    return null;
  }

  const rawName = typeof node.name?.value === 'string' ? node.name.value.trim() : '';
  if (rawName.length === 0) {
    return (
      "Interactive element with computed AX role '" +
      rawRole +
      "' has an empty accessible name in Chromium's accessibility tree."
    );
  }

  return null;
}

/**
 * Evaluates a single CDP `AXNode` for `ax_hidden_focus`.
 * Returns a human-readable detail message when a keyboard-focusable node (`tabIndex >= 0`)
 * is trapped inside an `aria-hidden="true"` or `inert` ancestor, or `null` when valid.
 */
export function evaluateAxNodeForHiddenFocus(
  node: ICdpAxNode,
  hasHiddenOrInertAncestor: boolean
): string | null {
  if (typeof node.backendDOMNodeId !== 'number') {
    return null;
  }

  if (!hasHiddenOrInertAncestor) {
    return null;
  }

  if (!isAxNodeFocusable(node)) {
    return null;
  }

  const rawRole =
    typeof node.role?.value === 'string' ? node.role.value.trim().toLowerCase() : 'control';
  return (
    "Keyboard-focusable element (AX role '" +
    rawRole +
    "') is nested inside an aria-hidden=\"true\" or inert container, creating a hidden focus trap."
  );
}

/**
 * Browser-injected helper invoked via CDP `Runtime.callFunctionOn` with `this` bound to a resolved
 * DOM (Document Object Model) `Element`. Computes its Shadow-DOM-piercing selector, enclosing
 * custom element `hostComponent`, ignore status, `--selectors` scope, and `aria-hidden`/`inert` state.
 */
function inspectResolvedDomElementInBrowser(
  this: unknown,
  pageUrl: string,
  rules: Array<IUirigIgnoreRule>,
  ignoreHelperSrc: string,
  activeSelectors: Array<string> | undefined,
  scopeHelperSrc: string
): IResolvedDomTargetMetadata | null {
  if (!(this instanceof Element)) {
    return null;
  }
  const targetEl: Element = this;

  const isIgnoredFn = new Function(
    'return (' + ignoreHelperSrc + ');'
  )() as typeof isElementIgnoredInBrowser;
  const isInScopeFn = new Function(
    'return (' + scopeHelperSrc + ');'
  )() as typeof isElementInSelectorScope;

  if (isIgnoredFn(targetEl, 'dom', pageUrl, rules)) {
    return {
      ignored: true,
      inScope: false,
      selector: '',
      hostComponent: null,
      inShadowDom: false,
      hasHiddenOrInertDomAncestor: false,
    };
  }

  const hasSelectors = Array.isArray(activeSelectors) && activeSelectors.length > 0;
  const inScope = !hasSelectors || isInScopeFn(targetEl, activeSelectors);
  if (!inScope) {
    return {
      ignored: false,
      inScope: false,
      selector: '',
      hostComponent: null,
      inShadowDom: false,
      hasHiddenOrInertDomAncestor: false,
    };
  }

  function buildLocalSegment(el: Element): string {
    const tag = el.tagName.toLowerCase();
    if (el.id) {
      return tag + '#' + el.id;
    }
    const classes = Array.from(el.classList).filter((c) => c.trim().length > 0);
    if (classes.length > 0) {
      return tag + '.' + classes.slice(0, 2).join('.');
    }
    return tag;
  }

  const rootSegments = new Array<string>();
  let current: Element | null = targetEl;
  let hostComponent: string | null = null;
  let inShadowDom = false;
  let hasHiddenOrInertDomAncestor = false;

  let ancestorCursor: Element | null = targetEl.parentElement;
  if (!ancestorCursor) {
    const firstRoot = targetEl.getRootNode();
    ancestorCursor = firstRoot instanceof ShadowRoot ? firstRoot.host : null;
  }
  while (ancestorCursor) {
    if (
      ancestorCursor.getAttribute('aria-hidden') === 'true' ||
      ancestorCursor.hasAttribute('inert')
    ) {
      hasHiddenOrInertDomAncestor = true;
      break;
    }
    const nextParent: HTMLElement | null = ancestorCursor.parentElement;
    if (nextParent) {
      ancestorCursor = nextParent;
    } else {
      const r: Node = ancestorCursor.getRootNode();
      ancestorCursor = r instanceof ShadowRoot ? r.host : null;
    }
  }

  const chainParts = new Array<string>();
  while (current) {
    const segment = buildLocalSegment(current);
    const parentEl: HTMLElement | null = current.parentElement;
    if (parentEl) {
      rootSegments.unshift(segment);
      current = parentEl;
    } else {
      rootSegments.unshift(segment);
      chainParts.unshift(rootSegments.join(' > '));
      rootSegments.length = 0;

      const rootNode: Node = current.getRootNode();
      if (rootNode instanceof ShadowRoot && rootNode.host) {
        inShadowDom = true;
        if (!hostComponent) {
          hostComponent = rootNode.host.tagName.toLowerCase();
        }
        chainParts.unshift('shadow-root');
        current = rootNode.host;
      } else {
        current = null;
      }
    }
  }

  return {
    ignored: false,
    inScope: true,
    selector: chainParts.join(' >> '),
    hostComponent,
    inShadowDom,
    hasHiddenOrInertDomAncestor,
  };
}

/**
 * Audits Chromium's native computed Accessibility Tree via CDP (`Accessibility.getFullAXTree`)
 * and returns `ax_empty_name` and `ax_hidden_focus` violations with Shadow DOM host attribution.
 */
export async function auditComputedAccessibilityTree(
  page: Page,
  options: IAxTreeAuditOptions = {}
): Promise<Array<IDomIntegrityViolation>> {
  const ignoreRules = options.ignoreRules ?? new Array<IUirigIgnoreRule>();
  const selectors = options.selectors;
  const violations = new Array<IDomIntegrityViolation>();

  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('Accessibility.enable');

    const treeResponse = (await cdp.send('Accessibility.getFullAXTree')) as {
      nodes?: Array<ICdpAxNode>;
    };
    const axNodes = treeResponse.nodes ?? new Array<ICdpAxNode>();
    const nodeById = new Map<string, ICdpAxNode>();
    for (const axNode of axNodes) {
      nodeById.set(axNode.nodeId, axNode);
    }

    function hasHiddenOrInertAxAncestor(startNode: ICdpAxNode): boolean {
      let parentId = startNode.parentId;
      const visited = new Set<string>([startNode.nodeId]);
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parentNode = nodeById.get(parentId);
        if (!parentNode) {
          break;
        }
        if (isAxNodeHiddenByAriaOrInert(parentNode)) {
          return true;
        }
        parentId = parentNode.parentId;
      }
      return false;
    }

    const pageUrl = page.url();
    const ignoreHelperSrc = isElementIgnoredInBrowser.toString();
    const scopeHelperSrc = isElementInSelectorScope.toString();
    const inspectFnSrc = inspectResolvedDomElementInBrowser.toString();
    const emittedKeys = new Set<string>();

    for (const axNode of axNodes) {
      const backendNodeId = axNode.backendDOMNodeId;
      if (typeof backendNodeId !== 'number') {
        continue;
      }

      const emptyNameDetail = evaluateAxNodeForEmptyName(axNode);
      const axHiddenAncestor = hasHiddenOrInertAxAncestor(axNode);
      const candidateHiddenFocus = isAxNodeFocusable(axNode);

      if (!emptyNameDetail && !candidateHiddenFocus) {
        continue;
      }

      let resolvedObjectId: string | undefined;
      try {
        const resolved = (await cdp.send('DOM.resolveNode', { backendNodeId })) as {
          object?: { objectId?: string };
        };
        resolvedObjectId = resolved.object?.objectId;
      } catch {
        continue;
      }

      if (!resolvedObjectId) {
        continue;
      }

      let meta: IResolvedDomTargetMetadata | null = null;
      try {
        const evalRes = (await cdp.send('Runtime.callFunctionOn', {
          objectId: resolvedObjectId,
          functionDeclaration: inspectFnSrc,
          arguments: [
            { value: pageUrl },
            { value: ignoreRules },
            { value: ignoreHelperSrc },
            { value: selectors ?? null },
            { value: scopeHelperSrc },
          ],
          returnByValue: true,
        })) as { result?: { value?: IResolvedDomTargetMetadata | null } };
        meta = evalRes.result?.value ?? null;
      } catch {
        meta = null;
      } finally {
        try {
          await cdp.send('Runtime.releaseObject', { objectId: resolvedObjectId });
        } catch {
          // Ignore object release errors on closed contexts
        }
      }

      if (!meta || meta.ignored || !meta.inScope || !meta.selector) {
        continue;
      }

      if (emptyNameDetail) {
        const key = 'ax_empty_name::' + meta.selector;
        if (!emittedKeys.has(key)) {
          emittedKeys.add(key);
          violations.push({
            rule: 'ax_empty_name',
            selector: meta.selector,
            hostComponent: meta.hostComponent,
            detail: emptyNameDetail,
            inShadowDom: meta.inShadowDom,
          });
        }
      }

      const hiddenFocusDetail = evaluateAxNodeForHiddenFocus(
        axNode,
        axHiddenAncestor || meta.hasHiddenOrInertDomAncestor
      );
      if (hiddenFocusDetail) {
        const key = 'ax_hidden_focus::' + meta.selector;
        if (!emittedKeys.has(key)) {
          emittedKeys.add(key);
          violations.push({
            rule: 'ax_hidden_focus',
            selector: meta.selector,
            hostComponent: meta.hostComponent,
            detail: hiddenFocusDetail,
            inShadowDom: meta.inShadowDom,
          });
        }
      }
    }
  } finally {
    try {
      await cdp.detach();
    } catch {
      // Ignore detach errors if page/context already closed
    }
  }

  return violations;
}
