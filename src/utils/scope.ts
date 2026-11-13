/**
 * src/utils/scope.ts
 * Component-scoped CSS selector parsing, browser syntax validation, and
 * Shadow-DOM-aware subtree matching for `--selectors` / `-s` audits.
 */

import type { Page } from 'playwright';

/**
 * Splits a comma-separated CSS selector string into trimmed, non-empty selectors
 * while respecting nested `[...]` attribute brackets and `(...)` pseudo-classes
 * (e.g., `:is(.a, .b)` or `[data-x="1,2"]`).
 */
export function parseSelectorList(raw: string): string[] {
  const results: string[] = [];
  let current = '';
  let bracketDepth = 0;
  let parenDepth = 0;
  let activeQuote: '"' | "'" | null = null;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] ?? '';
    const prev = i > 0 ? raw[i - 1] : '';

    if (activeQuote) {
      current += ch;
      if (ch === activeQuote && prev !== '\\') {
        activeQuote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      activeQuote = ch;
      current += ch;
    } else if (ch === '[') {
      bracketDepth++;
      current += ch;
    } else if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += ch;
    } else if (ch === '(') {
      parenDepth++;
      current += ch;
    } else if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
    } else if (ch === ',' && bracketDepth === 0 && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        results.push(trimmed);
      }
      current = '';
    } else {
      current += ch;
    }
  }

  const finalTrimmed = current.trim();
  if (finalTrimmed.length > 0) {
    results.push(finalTrimmed);
  }

  return Array.from(new Set(results));
}

/**
 * Validates every CSS selector against the browser's native `document.querySelector()`
 * parser. Throws an `ERR_INVALID_SELECTOR` error (POSIX exit code 1) if any selector
 * has invalid CSS syntax.
 */
export async function validateSelectorsInBrowser(
  page: Page,
  selectors: string[]
): Promise<void> {
  if (selectors.length === 0) {
    return;
  }

  const invalidSelector = await page.evaluate((sels: string[]): string | null => {
    for (const sel of sels) {
      try {
        document.querySelector(sel);
      } catch {
        return sel;
      }
    }
    return null;
  }, selectors);

  if (invalidSelector !== null) {
    throw new Error(
      `ERR_INVALID_SELECTOR: Invalid CSS selector '${invalidSelector}' passed to --selectors.`
    );
  }
}

/**
 * Pure browser-side helper that checks whether `el` matches any selector in `selectors`
 * directly OR is a descendant (across Light DOM and open `ShadowRoot.host` boundaries)
 * of an element matching any selector in `selectors`.
 * When `selectors` is undefined or empty, returns `true` (full-page audit).
 */
export function isElementInSelectorScope(
  el: Element,
  selectors?: string[]
): boolean {
  if (!selectors || selectors.length === 0) {
    return true;
  }

  let current: Node | null = el;
  while (current !== null) {
    if (current.nodeType === 1 /* ELEMENT_NODE */) {
      const element = current as Element;
      for (const sel of selectors) {
        try {
          if (element.matches(sel)) {
            return true;
          }
        } catch {
          // Ignore malformed selector during walk (caught upfront by validateSelectorsInBrowser)
        }
      }
      current = element.parentElement ?? element.getRootNode();
    } else if (current instanceof ShadowRoot) {
      current = current.host;
    } else {
      current = null;
    }
  }

  return false;
}
