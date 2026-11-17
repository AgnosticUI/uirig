/**
 * @file src/utils/spatial-brief.ts
 * @description Pure data structures and deterministic formatter for the
 * `--spatial-brief` flag (Issue #5). Compresses viewport-relative layout
 * geometry into an ultra-compact plain-text string (~40-60 tokens) so AI
 * coding agents can verify macro-layout without expensive vision screenshots.
 */

/**
 * Represents a single measured landmark, custom element host, or target selector
 * extracted from the rendered DOM / Shadow DOM tree.
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

/**
 * Configuration options for `formatSpatialBrief`.
 */
export interface FormatSpatialBriefOptions {
  /** Maximum number of nodes emitted before truncating (defaults to 20). */
  maxNodes?: number;
}

/** Default safety cap so pathological pages never blow up LLM token budgets. */
export const DEFAULT_MAX_SPATIAL_NODES = 20;

/**
 * Formats an array of measured `SpatialNode` entries into a single-line,
 * pipe-delimited spatial summary: `header[0,0 1440x64] | main[0,64 1440x836]`.
 *
 * Processing pipeline:
 * 1. Round coordinates to integers and discard non-rendered (`<= 0`) boxes.
 * 2. Deduplicate identical `(label, x, y, width, height)` entries.
 * 3. Sort in visual reading order (`y` ascending, then `x` ascending, then `label`).
 * 4. Cap output length to `maxNodes` (appending `|+N more` if truncated).
 */
export function formatSpatialBrief(
  nodes: readonly SpatialNode[],
  options: FormatSpatialBriefOptions = {},
): string {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_SPATIAL_NODES;
  console.log(
    `[uirig:spatial-brief] Formatting ${nodes.length} raw spatial nodes (maxNodes=${maxNodes})`,
  );

  // Step 1 & 2: Normalize numbers, drop zero/negative dimensions, and deduplicate.
  const seenKeys = new Set<string>();
  const normalized: SpatialNode[] = [];

  for (const node of nodes) {
    const label = node.label.trim();
    const x = Math.round(node.x);
    const y = Math.round(node.y);
    const width = Math.round(node.width);
    const height = Math.round(node.height);

    // Skip empty labels or unrendered/collapsed elements.
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

  // Step 3: Sort top-to-bottom (y), then left-to-right (x), then lexicographically.
  normalized.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.label.localeCompare(b.label);
  });

  if (normalized.length === 0) {
    console.log('[uirig:spatial-brief] No visible spatial nodes remaining after filtering');
    return '';
  }

  // Step 4: Enforce maxNodes cap so output stays within the ~40-60 token budget.
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
