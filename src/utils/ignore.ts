/**
 * src/utils/ignore.ts
 * Runtime-native rule escape hatches for `uirig`.
 * Supports two bundler-proof exemption mechanisms:
 * 1. Markup attributes: `data-uirig-ignore="<rule>|all"` (comma/space separated, walking
 *    up parent elements and crossing open `ShadowRoot.host` boundaries).
 * 2. Config rules: `ignore: [{ rule, selector?, url? }]` inside `uirig.config.json`.
 */

export interface IUirigIgnoreRule {
  rule: string;
  selector?: string;
  url?: string;
}

/**
 * Normalizes a rule/engine name for case-insensitive matching.
 */
function normalizeRuleToken(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Checks whether a `data-uirig-ignore` attribute string matches a given `ruleName`.
 * Supports `"all"`, `"*"`, or comma/whitespace-separated rule lists (e.g. `"tokens, contrast"`).
 */
export function matchesIgnoreAttributeValue(
  attrValue: string | null | undefined,
  ruleName: string
): boolean {
  if (!attrValue) {
    return false;
  }

  const targetRule = normalizeRuleToken(ruleName);
  const tokens = attrValue
    .split(/[\s,]+/)
    .map(normalizeRuleToken)
    .filter((token) => token.length > 0);

  return tokens.includes('all') || tokens.includes('*') || tokens.includes(targetRule);
}

/**
 * Checks whether a URL matches an optional rule URL filter.
 * Supports exact matches, prefix/substring matches, or trailing `*` wildcards.
 */
export function matchesIgnoreUrl(currentUrl: string, ruleUrl?: string): boolean {
  if (!ruleUrl || ruleUrl.trim().length === 0) {
    return true;
  }

  const trimmedRuleUrl = ruleUrl.trim();
  if (trimmedRuleUrl.endsWith('*')) {
    const prefix = trimmedRuleUrl.slice(0, -1);
    return currentUrl.startsWith(prefix);
  }

  return currentUrl === trimmedRuleUrl || currentUrl.includes(trimmedRuleUrl);
}

/**
 * Evaluates a violation selector/URL against `uirig.config.json` `ignore` rules on the Node side.
 * Useful for filtering violations post-crawl or when `Element.closest()` is not in scope.
 */
export function isSelectorIgnoredByConfig(
  selectorPath: string,
  ruleName: string,
  currentUrl: string,
  ignoreRules: IUirigIgnoreRule[] = []
): boolean {
  const targetRule = normalizeRuleToken(ruleName);

  for (const entry of ignoreRules) {
    const entryRule = normalizeRuleToken(entry.rule);
    if (entryRule !== 'all' && entryRule !== '*' && entryRule !== targetRule) {
      continue;
    }

    if (!matchesIgnoreUrl(currentUrl, entry.url)) {
      continue;
    }

    // If no selector is specified on the rule, the entire URL/route is exempt for this rule
    if (!entry.selector || entry.selector.trim().length === 0) {
      return true;
    }

    if (selectorPath.includes(entry.selector.trim())) {
      return true;
    }
  }

  return false;
}

/**
 * Browser-context DOM evaluator that walks up an element's ancestor chain,
 * crossing open `ShadowRoot.host` boundaries, to check:
 * 1. `data-uirig-ignore="<rule>|all"` attributes on the element or any ancestor.
 * 2. Matching `ignore` rules from `uirig.config.json` via `Element.closest(rule.selector)`.
 *
 * Designed to be passed into `page.evaluate(...)` or called directly inside browser scripts.
 */
export function isElementIgnoredInBrowser(
  el: Element,
  ruleName: string,
  currentUrl: string,
  ignoreRules: IUirigIgnoreRule[] = []
): boolean {
  const targetRule = ruleName.trim().toLowerCase();

  const attrMatches = (rawAttr: string | null): boolean => {
    if (!rawAttr) {
      return false;
    }
    const parts = rawAttr
      .split(/[\s,]+/)
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0);
    return parts.includes('all') || parts.includes('*') || parts.includes(targetRule);
  };

  // 1. Walk up Light DOM and cross open ShadowRoot.host boundaries for `data-uirig-ignore`
  let cursor: Node | null = el;
  while (cursor) {
    if (cursor.nodeType === 1) {
      const elementNode = cursor as Element;
      if (attrMatches(elementNode.getAttribute('data-uirig-ignore'))) {
        return true;
      }
      cursor = elementNode.parentElement ?? elementNode.getRootNode();
    } else if (cursor instanceof ShadowRoot) {
      cursor = cursor.host;
    } else {
      cursor = null;
    }
  }

  // 2. Evaluate config-level ignore rules (`rule`, `selector`, `url`)
  for (const entry of ignoreRules) {
    const entryRule = entry.rule.trim().toLowerCase();
    if (entryRule !== 'all' && entryRule !== '*' && entryRule !== targetRule) {
      continue;
    }

    if (entry.url && entry.url.trim().length > 0) {
      const trimmedRuleUrl = entry.url.trim();
      const urlMatched = trimmedRuleUrl.endsWith('*')
        ? currentUrl.startsWith(trimmedRuleUrl.slice(0, -1))
        : currentUrl === trimmedRuleUrl || currentUrl.includes(trimmedRuleUrl);
      if (!urlMatched) {
        continue;
      }
    }

    if (!entry.selector || entry.selector.trim().length === 0) {
      return true;
    }

    // Check `closest(selector)` in current tree and across enclosing ShadowRoot hosts
    let matchCursor: Node | null = el;
    while (matchCursor) {
      if (matchCursor.nodeType === 1) {
        const elementNode = matchCursor as Element;
        try {
          if (elementNode.closest(entry.selector)) {
            return true;
          }
        } catch {
          // Ignore invalid CSS selector syntax in user config without crashing the audit
        }
        matchCursor = elementNode.getRootNode();
      } else if (matchCursor instanceof ShadowRoot) {
        matchCursor = matchCursor.host;
      } else {
        matchCursor = null;
      }
    }
  }

  return false;
}
