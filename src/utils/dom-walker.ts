/**
 * src/utils/dom-walker.ts
 * Shared Light DOM & open ShadowRoot traversal utilities for `uirig`.
 * Provides:
 * 1. Pure Node-side selector & Shadow host extraction (`extractHostComponentFromSelector`).
 * 2. Self-contained browser-context DOM walker (`createBrowserDomWalker`) that pierces
 *    open `ShadowRoot` boundaries, resolves `hostComponent` custom element tags,
 *    enforces `isElementIgnoredInBrowser`, and filters by `--selectors` scope.
 */

import type { IUirigIgnoreRule } from './ignore.js';

export interface IWalkedElementMetadata {
  selector: string;
  hostComponent: string | null;
  inShadowDom: boolean;
}

/**
 * Extracts the nearest enclosing Web Component custom element tag (`hostComponent`)
 * from a serialized selector breadcrumb (e.g. `"ag-card >> shadow-root >> ag-button >> shadow-root >> button"` -> `"ag-button"`).
 * Returns `null` when the element resides in Light DOM.
 */
export function extractHostComponentFromSelector(selectorPath: string): string | null {
  const shadowMarker = ' >> shadow-root';
  const lastMarkerIdx = selectorPath.lastIndexOf(shadowMarker);
  if (lastMarkerIdx === -1) {
    return null;
  }

  const beforeMarker = selectorPath.slice(0, lastMarkerIdx).trim();
  const segments = beforeMarker.split('>>').map((segment) => segment.trim());
  const rawHostToken = segments.at(-1) ?? '';
  if (!rawHostToken) {
    return null;
  }

  // Strip `#id` or `.class` suffixes to return the clean custom element tag name (e.g., "ag-button")
  const tagOnly = rawHostToken.split(/[#.]/).at(0) ?? '';
  return tagOnly.length > 0 ? tagOnly.toLowerCase() : null;
}

/**
 * Browser-context DOM traversal helper designed to be serialized into `page.evaluate()`.
 * IMPORTANT: Must contain ZERO runtime references to imported module values in its body
 * or default parameters so `createBrowserDomWalker.toString()` executes cleanly inside Chromium V8.
 */
export function createBrowserDomWalker(
  currentUrl: string,
  ignoreRules: IUirigIgnoreRule[] = [],
  ignoreHelperSource?: string,
  selectors?: string[],
  scopeHelperSource?: string
): {
  formatSelector: (el: Element) => string;
  resolveHostComponent: (el: Element) => string | null;
  isIgnored: (el: Element, ruleName: string) => boolean;
  isInScope: (el: Element) => boolean;
  walkElements: (
    onElement: (el: Element, meta: IWalkedElementMetadata) => void,
    options?: { includeBody?: boolean }
  ) => void;
} {
  type IgnorePredicate = (
    el: Element,
    ruleName: string,
    url: string,
    rules: IUirigIgnoreRule[]
  ) => boolean;
  type ScopePredicate = (el: Element, activeSelectors?: string[]) => boolean;

  const checkIgnored: IgnorePredicate = ignoreHelperSource
    ? (new Function(`return (${ignoreHelperSource});`)() as IgnorePredicate)
    : () => false;

  const checkInScope: ScopePredicate = scopeHelperSource
    ? (new Function(`return (${scopeHelperSource});`)() as ScopePredicate)
    : () => true;

  const activeSelectors = selectors && selectors.length > 0 ? selectors : undefined;

  const nonVisualTags = new Set([
    'HTML',
    'HEAD',
    'SCRIPT',
    'STYLE',
    'META',
    'LINK',
    'NOSCRIPT',
    'TEMPLATE',
  ]);

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

  function resolveHostComponent(el: Element): string | null {
    const rootNode = el.getRootNode();
    if (rootNode instanceof ShadowRoot && rootNode.host) {
      return rootNode.host.tagName.toLowerCase();
    }
    return null;
  }

  function isIgnored(el: Element, ruleName: string): boolean {
    return checkIgnored(el, ruleName, currentUrl, ignoreRules);
  }

  function isInScope(el: Element): boolean {
    return checkInScope(el, activeSelectors);
  }

  function walkElements(
    onElement: (el: Element, meta: IWalkedElementMetadata) => void,
    options: { includeBody?: boolean } = {}
  ): void {
    const includeBody = options.includeBody ?? true;

    function traverseRoot(
      root: Document | ShadowRoot,
      shadowPrefix: string,
      insideShadow: boolean,
      activeHostTag: string | null
    ): void {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let currentNode = walker.nextNode() as Element | null;

      while (currentNode) {
        if (!nonVisualTags.has(currentNode.tagName)) {
          const elementLabel = formatSelector(currentNode);
          const fullSelector = shadowPrefix ? `${shadowPrefix} >> ${elementLabel}` : elementLabel;

          if (
            (includeBody || currentNode.tagName !== 'BODY') &&
            checkInScope(currentNode, activeSelectors)
          ) {
            onElement(currentNode, {
              selector: fullSelector,
              hostComponent: activeHostTag,
              inShadowDom: insideShadow,
            });
          }

          if (currentNode.shadowRoot) {
            const nextShadowPrefix = `${fullSelector} >> shadow-root`;
            const hostTag = currentNode.tagName.toLowerCase();
            traverseRoot(currentNode.shadowRoot, nextShadowPrefix, true, hostTag);
          }
        }

        currentNode = walker.nextNode() as Element | null;
      }
    }

    traverseRoot(document, '', false, null);
  }

  return {
    formatSelector,
    resolveHostComponent,
    isIgnored,
    isInScope,
    walkElements,
  };
}
