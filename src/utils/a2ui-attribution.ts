/**
 * src/utils/a2ui-attribution.ts
 * Universal A2UI (Agent-to-UI) `<a2ui-surface>` Component Attribution (Issue #31).
 * Resolves composed Light DOM (Document Object Model) and open `ShadowRoot` ancestors
 * inside `<a2ui-surface>` into an out-of-band `IA2uiAttribution` record with zero
 * modifications to official A2UI v1.0 wire or AG-UI schemas.
 */

import type { Page } from 'playwright';
import type { IA2uiAttribution } from '../interfaces/locator.js';

export interface IA2uiElementNodeLike {
  tagName: string;
  id?: string;
  parentElement: IA2uiElementNodeLike | null;
  getAttribute(name: string): string | null;
  getRootNode?: () => { host?: IA2uiElementNodeLike | null };
  querySelectorAll?: (selector: string) => Iterable<IA2uiElementNodeLike>;
  component?: { id?: unknown; component?: unknown } | null;
  surfaceId?: unknown;
  catalogId?: unknown;
}

/**
 * Pure composed-tree resolver that walks upward from `startEl` through `parentElement`
 * and `ShadowRoot.host` boundaries to extract `<a2ui-surface>` attribution metadata.
 * Returns `null` when `startEl` is not enclosed by an `<a2ui-surface>` element.
 */
export function resolveA2uiAttributionFromComposedChain(
  startEl: IA2uiElementNodeLike | null
): IA2uiAttribution | null {
  if (!startEl) {
    return null;
  }

  let current: IA2uiElementNodeLike | null = startEl;
  let a2uiComponentId: string | null = null;
  let a2uiComponentType: string | null = null;
  let explicitWirePath: string | null = null;
  let matchedComponentNode: IA2uiElementNodeLike | null = null;
  let surfaceNode: IA2uiElementNodeLike | null = null;

  while (current) {
    const tag = (current.tagName ?? '').toLowerCase();

    if (a2uiComponentId === null) {
      const attrId = (current.getAttribute('data-a2ui-id') ?? '').trim();
      const propId =
        typeof current.component?.id === 'string' ? current.component.id.trim() : '';
      const resolvedId = attrId || propId;

      if (resolvedId.length > 0) {
        a2uiComponentId = resolvedId;
        matchedComponentNode = current;

        const attrType = (current.getAttribute('data-a2ui-component') ?? '').trim();
        const propType =
          typeof current.component?.component === 'string'
            ? current.component.component.trim()
            : '';
        a2uiComponentType = attrType || propType || null;

        const attrWirePath = (current.getAttribute('data-a2ui-wire-path') ?? '').trim();
        if (attrWirePath.length > 0) {
          explicitWirePath = attrWirePath;
        }
      }
    }

    if (tag === 'a2ui-surface') {
      surfaceNode = current;
      break;
    }

    if (current.parentElement) {
      current = current.parentElement;
    } else if (typeof current.getRootNode === 'function') {
      const rootNode = current.getRootNode();
      current = rootNode && rootNode.host ? rootNode.host : null;
    } else {
      current = null;
    }
  }

  if (!surfaceNode) {
    return null;
  }

  const attrSurfaceId = (
    surfaceNode.getAttribute('surface-id') ??
    surfaceNode.getAttribute('id') ??
    surfaceNode.id ??
    ''
  ).trim();
  const propSurfaceId =
    typeof surfaceNode.surfaceId === 'string' ? surfaceNode.surfaceId.trim() : '';
  const surfaceId = attrSurfaceId || propSurfaceId || null;

  const attrCatalogId = (surfaceNode.getAttribute('catalog-id') ?? '').trim();
  const propCatalogId =
    typeof surfaceNode.catalogId === 'string' ? surfaceNode.catalogId.trim() : '';
  const catalogId = attrCatalogId || propCatalogId || null;

  let wirePath: string | null = explicitWirePath;
  if (!wirePath && a2uiComponentId && typeof surfaceNode.querySelectorAll === 'function') {
    const allComponentNodes = Array.from(surfaceNode.querySelectorAll('[data-a2ui-id]'));
    const idx = allComponentNodes.findIndex(
      (node) =>
        node === matchedComponentNode ||
        (node.getAttribute('data-a2ui-id') ?? '').trim() === a2uiComponentId
    );
    if (idx >= 0) {
      wirePath = '/components/' + String(idx);
    }
  }

  return {
    surfaceId,
    a2uiComponentId,
    a2uiComponentType,
    catalogId,
    wirePath,
    suggestedPatch: null,
  };
}

/**
 * Evaluates a list of piercing CSS/Shadow-DOM selector paths on a live Playwright `Page`
 * and returns a map of `selector -> IA2uiAttribution | null`.
 */
export async function resolveA2uiAttributionsForSelectors(
  page: Page,
  selectors: ReadonlyArray<string>
): Promise<Map<string, IA2uiAttribution | null>> {
  const uniqueSelectors = Array.from(new Set(selectors.filter((s) => s.trim().length > 0)));
  const resultMap = new Map<string, IA2uiAttribution | null>();
  if (uniqueSelectors.length === 0) {
    return resultMap;
  }

  const resolvedPairs = await page.evaluate(
    ({
      selectorList,
      resolverSrc,
    }: {
      selectorList: Array<string>;
      resolverSrc: string;
    }): Array<{ selector: string; attribution: IA2uiAttribution | null }> => {
      const resolveFromChain = new Function(
        'return (' + resolverSrc + ');'
      )() as typeof resolveA2uiAttributionFromComposedChain;

      function queryPiercingSelector(selectorPath: string): Element | null {
        if (!selectorPath || selectorPath === 'document' || selectorPath === 'window') {
          return null;
        }
        // Normalize `host::shadow > inner` or `host >> shadow-root >> inner` into ShadowRoot hops
        const normalized = selectorPath.replace(/::shadow\s*>\s*/g, ' >> shadow-root >> ');
        const segments = normalized
          .split('>> shadow-root >>')
          .map((s) => s.trim())
          .filter(Boolean);

        let searchRoot: Document | ShadowRoot = document;
        let foundEl: Element | null = null;

        for (let i = 0; i < segments.length; i++) {
          const part = segments.at(i) ?? '';
          try {
            foundEl = searchRoot.querySelector(part);
          } catch {
            return null;
          }
          if (!foundEl) {
            return null;
          }
          if (i < segments.length - 1) {
            if (!foundEl.shadowRoot) {
              return null;
            }
            searchRoot = foundEl.shadowRoot;
          }
        }
        return foundEl;
      }

      return selectorList.map((sel) => {
        const el = queryPiercingSelector(sel);
        return {
          selector: sel,
          attribution: resolveFromChain(el as unknown as IA2uiElementNodeLike | null),
        };
      });
    },
    {
      selectorList: uniqueSelectors,
      resolverSrc: resolveA2uiAttributionFromComposedChain.toString(),
    }
  );

  for (const item of resolvedPairs) {
    resultMap.set(item.selector, item.attribution);
  }

  return resultMap;
}
