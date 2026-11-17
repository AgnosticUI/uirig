/**
 * @file src/utils/spatial-brief.ts
 * @description Pure data structures, Shadow-DOM-aware browser collector, and
 * deterministic formatter for the `--spatial-brief` flag (Issue #5). Compresses
 * viewport-relative layout geometry into an ultra-compact plain-text string
 * (~40-60 tokens) so AI coding agents can verify macro-layout without vision tokens.
 */

export interface SpatialNode {
  /** Compact identifier such as `header`, `aside`, `main`, or `ag-card#hero`. */
  label: string;
  /** Viewport-relative left coordinate in CSS pixels. */
  x: number;
  /** Viewport-relative top coordinate in CSS pixels. */
  y: number;
  /** Rendered bounding-box width in CSS pixels. */
  width: number;
  /** Rendered bounding-box height in CSS pixels. */
  height: number;
}

export interface FormatSpatialBriefOptions {
  /** Maximum number of nodes emitted before truncating (defaults to 20). */
  maxNodes?: number;
}

/** Default safety cap so pathological pages never blow up LLM token budgets. */
export const DEFAULT_MAX_SPATIAL_NODES = 20;

/**
 * Browser-context collector designed to be passed directly to `page.evaluate()`.
 * Self-contained (zero external closure references) so Playwright can serialize it cleanly.
 */
export function collectSpatialNodes(
  selectors: ReadonlyArray<string> = new Array<string>(),
): Array<SpatialNode> {
  const LANDMARK_TAGS = new Set(['HEADER', 'NAV', 'ASIDE', 'MAIN', 'FOOTER']);
  const LANDMARK_ROLES = new Set([
    'banner',
    'navigation',
    'complementary',
    'main',
    'contentinfo',
  ]);

  const results = new Array<SpatialNode>();
  const visitedElements = new Set<Element>();

  const buildLabel = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    if (el.id) {
      return `${tag}#${el.id}`;
    }
    const role = el.getAttribute('role');
    if (role && !LANDMARK_TAGS.has(el.tagName)) {
      return `${tag}[role=${role}]`;
    }
    return tag;
  };

  const isVisible = (el: Element): boolean => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const recordElement = (el: Element): void => {
    if (visitedElements.has(el) || !isVisible(el)) {
      return;
    }
    visitedElements.add(el);
    const rect = el.getBoundingClientRect();
    results.push({
      label: buildLabel(el),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  };
  const walkTree = (root: Document | ShadowRoot, insideCustomHost: boolean): void => {
    const elements = root.querySelectorAll('*');
    for (const el of Array.from(elements)) {
      const isCustomHost = el.tagName.includes('-');
      const role = (el.getAttribute('role') ?? '').toLowerCase();
      const isLandmark = LANDMARK_TAGS.has(el.tagName) || LANDMARK_ROLES.has(role);
      const isTopLevelCustom = isCustomHost && !insideCustomHost;

      if (isLandmark || isTopLevelCustom) {
        recordElement(el);
      }

      if (el.shadowRoot) {
        walkTree(el.shadowRoot, insideCustomHost || isCustomHost);
      }
    }
  };

  const collectExplicitSelectors = (root: Document | ShadowRoot): void => {
    for (const selector of selectors) {
      const trimmed = selector.trim();
      if (!trimmed) continue;
      try {
        const matches = root.querySelectorAll(trimmed);
        for (const match of Array.from(matches)) {
          recordElement(match);
        }
      } catch {
        // Ignore invalid CSS selectors in browser context; CLI validation handles syntax errors.
      }
    }

    const allHosts = root.querySelectorAll('*');
    for (const el of Array.from(allHosts)) {
      if (el.shadowRoot) {
        collectExplicitSelectors(el.shadowRoot);
      }
    }
  };

  if (document.body) {
    walkTree(document, false);
    if (selectors.length > 0) {
      collectExplicitSelectors(document);
    }
  }

  return results;
}

/**
 * Formats an array of measured `SpatialNode` entries into a single-line,
 * pipe-delimited spatial summary: `header[0,0 1440x64] | main[0,64 1440x836]`.
 */
export function formatSpatialBrief(
  nodes: ReadonlyArray<SpatialNode>,
  options: FormatSpatialBriefOptions = {},
): string {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_SPATIAL_NODES;
  console.log(
    `[uirig:spatial-brief] Formatting ${nodes.length} raw spatial nodes (maxNodes=${maxNodes})`,
  );

  const seenKeys = new Set<string>();
  const normalized = new Array<SpatialNode>();

  for (const node of nodes) {
    const label = node.label.trim();
    const x = Math.round(node.x);
    const y = Math.round(node.y);
    const width = Math.round(node.width);
    const height = Math.round(node.height);

    if (!label || width <= 0 || height <= 0) {
      continue;
    }

    const dedupeKey = `${label}@${x},${y},${width}x${height}`;
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    normalized.push({ label, x, y, width, height });
  }

  normalized.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.label.localeCompare(b.label);
  });

  if (normalized.length === 0) {
    console.log('[uirig:spatial-brief] No visible spatial nodes remaining after filtering');
    return '';
  }

  const visibleSlice = normalized.slice(0, Math.max(0, maxNodes));
  const omittedCount = normalized.length - visibleSlice.length;

  const segments = visibleSlice.map(
    (n) => `${n.label}[${n.x},${n.y} ${n.width}x${n.height}]`,
  );

  if (omittedCount > 0) {
    segments.push(`+${omittedCount} more`);
  }

  const formatted = segments.join(' | ');
  console.log(`[uirig:spatial-brief] Emitted brief (${visibleSlice.length} nodes): ${formatted}`);
  return formatted;
}
