/**
 * src/core/auto-tokens.ts
 * Zero-Config Design Token Auto-Discovery (`--auto-tokens`).
 * Classifies and normalizes CSS colors and dimensional lengths into `ITokenScaleConfig`
 * buckets (`colors`, `spacing`, `fontSizes`, `radii`), discovers tokens from W3C `.tokens.json`,
 * Style Dictionary JSON, and Tailwind v4 `@theme` CSS files, and merges token sources.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, basename } from 'path';
import Color from 'colorjs.io';
import type { ITokenScaleConfig } from './tokens.js';
import { BLOCKLIST_DIRECTORIES } from './crawler.js';

export type TokenScaleCategory = keyof ITokenScaleConfig;

export interface IClassifiedToken {
  category: TokenScaleCategory;
  normalizedValue: string;
}

/**
 * Creates an empty `ITokenScaleConfig` container.
 */
export function createEmptyTokenScale(): ITokenScaleConfig {
  return {
    colors: [],
    spacing: [],
    fontSizes: [],
    radii: [],
  };
}

/**
 * Formats an sRGB `colorjs.io` `Color` instance to match Chromium's `getComputedStyle()`
 * serialization (`rgb(r, g, b)` when opaque, `rgba(r, g, b, a)` when translucent).
 */
function formatComputedRgbString(color: Color): string {
  const srgb = color.to('srgb');
  const [rawR, rawG, rawB] = srgb.coords;
  const r255 = Math.round(Math.min(1, Math.max(0, rawR ?? 0)) * 255);
  const g255 = Math.round(Math.min(1, Math.max(0, rawG ?? 0)) * 255);
  const b255 = Math.round(Math.min(1, Math.max(0, rawB ?? 0)) * 255);
  const alpha = color.alpha ?? 1;

  if (alpha < 1) {
    const roundedAlpha = Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000;
    return 'rgba(' + r255 + ', ' + g255 + ', ' + b255 + ', ' + roundedAlpha + ')';
  }
  return 'rgb(' + r255 + ', ' + g255 + ', ' + b255 + ')';
}

/**
 * Attempts to parse a CSS color string into a canonical `rgb(...)` or `rgba(...)` value.
 * Returns `null` for non-color tokens (lengths, numbers, font stacks, shadows, etc.).
 */
export function normalizeCssColorToken(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  // Reject pure numbers, percentages, or CSS lengths before invoking `colorjs.io`
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:%|px|rem|em|vh|vw|vmin|vmax|ch|ex|pt|pc|cm|mm|in|deg|rad|turn|s|ms)?$/i.test(trimmed)) {
    return null;
  }

  // Reject CSS custom property references, W3C alias references `{...}`, or multi-value shorthands
  if (trimmed.startsWith('var(') || trimmed.startsWith('{') || trimmed.includes(';')) {
    return null;
  }

  try {
    const parsed = new Color(trimmed);
    if (!parsed || !parsed.space) {
      return null;
    }
    return formatComputedRgbString(parsed);
  } catch {
    return null;
  }
}
/**
 * Normalizes a CSS length token (`0`, `16px`, `1.5rem`, `0.75em`) into pixel string (`16px`, `24px`, `12px`).
 * Returns `null` if the value is not a supported pixel or root-relative length.
 */
export function normalizeCssLengthToPx(rawValue: string, rootFontSizePx: number = 16): string | null {
  const trimmed = rawValue.trim().toLowerCase();
  if (trimmed === '0') {
    return '0px';
  }

  const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem|em)$/);
  if (!match) {
    return null;
  }

  const numeric = Number.parseFloat(match[1] ?? '');
  const unit = match[2];
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  const pxValue = unit === 'px' ? numeric : numeric * rootFontSizePx;
  const rounded = Math.round(pxValue * 100) / 100;
  return String(rounded) + 'px';
}

/**
 * Infers which dimensional scale (`radii`, `fontSizes`, or `spacing`) a length token belongs to
 * based on its CSS custom property name or token path (e.g. `--radius-md`, `--font-size-lg`, `--spacing-4`).
 */
export function inferLengthCategoryFromName(tokenName: string): Exclude<TokenScaleCategory, 'colors'> {
  const normalizedName = tokenName.toLowerCase();

  if (/(?:radius|radii|rounded|corner)/i.test(normalizedName)) {
    return 'radii';
  }

  if (/(?:font-size|fontsize|font|text-|text\.|typography|leading|type-scale)/i.test(normalizedName)) {
    return 'fontSizes';
  }

  return 'spacing';
}

/**
 * Classifies and normalizes a single `(tokenName, rawValue)` pair into an `ITokenScaleConfig`
 * bucket (`colors`, `spacing`, `fontSizes`, or `radii`). Returns `null` for non-style tokens
 * (font families, z-index, durations, shadows, un-evaluated `var(...)` expressions).
 */
export function classifyAndNormalizeTokenValue(
  tokenName: string,
  rawValue: string,
  rootFontSizePx: number = 16
): IClassifiedToken | null {
  const normalizedColor = normalizeCssColorToken(rawValue);
  if (normalizedColor !== null) {
    return {
      category: 'colors',
      normalizedValue: normalizedColor,
    };
  }

  const normalizedLength = normalizeCssLengthToPx(rawValue, rootFontSizePx);
  if (normalizedLength !== null) {
    return {
      category: inferLengthCategoryFromName(tokenName),
      normalizedValue: normalizedLength,
    };
  }

  return null;
}

/**
 * Merges one or more `ITokenScaleConfig` objects into a single deduplicated scale.
 * Always ensures `'0px'` is present in `spacing` and `radii` when any spacing/radii tokens exist.
 */
export function mergeTokenScales(...scales: Array<Partial<ITokenScaleConfig>>): ITokenScaleConfig {
  const colorSet = new Set<string>();
  const spacingSet = new Set<string>();
  const fontSizeSet = new Set<string>();
  const radiiSet = new Set<string>();

  for (const scale of scales) {
    for (const c of scale.colors ?? []) {
      const trimmed = c.trim();
      if (trimmed) {
        colorSet.add(trimmed);
      }
    }
    for (const s of scale.spacing ?? []) {
      const trimmed = s.trim();
      if (trimmed) {
        spacingSet.add(trimmed);
      }
    }
    for (const f of scale.fontSizes ?? []) {
      const trimmed = f.trim();
      if (trimmed) {
        fontSizeSet.add(trimmed);
      }
    }
    for (const r of scale.radii ?? []) {
      const trimmed = r.trim();
      if (trimmed) {
        radiiSet.add(trimmed);
      }
    }
  }

  if (spacingSet.size > 0) {
    spacingSet.add('0px');
  }
  if (radiiSet.size > 0) {
    radiiSet.add('0px');
  }

  return {
    colors: Array.from(colorSet),
    spacing: Array.from(spacingSet),
    fontSizes: Array.from(fontSizeSet),
    radii: Array.from(radiiSet),
  };
}

/**
 * Parses a W3C Design Tokens (`$value`) or Style Dictionary (`value`) JSON string
 * into a normalized `ITokenScaleConfig`.
 */
export function parseW3cOrStyleDictionaryTokens(rawJson: string): ITokenScaleConfig {
  const scale = createEmptyTokenScale();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return scale;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return scale;
  }

  function walkTokenTree(node: unknown, pathSegments: string[]): void {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      return;
    }

    const record = node as Record<string, unknown>;
    const rawLeaf = record.$value !== undefined ? record.$value : record.value;

    if (typeof rawLeaf === 'string' || typeof rawLeaf === 'number') {
      const tokenPath = pathSegments.join('.');
      const classified = classifyAndNormalizeTokenValue(tokenPath, String(rawLeaf));
      if (classified) {
        scale[classified.category].push(classified.normalizedValue);
      }
      return;
    }

    for (const [key, child] of Object.entries(record)) {
      if (key.startsWith('$')) {
        continue;
      }
      walkTokenTree(child, [...pathSegments, key]);
    }
  }

  walkTokenTree(parsed, []);
  return mergeTokenScales(scale);
}

/**
 * Extracts CSS custom property declarations (`--name: value;`) from Tailwind v4 `@theme { ... }`
 * blocks in a CSS stylesheet and classifies them into an `ITokenScaleConfig`.
 */
export function parseTailwindThemeCss(rawCss: string): ITokenScaleConfig {
  const scale = createEmptyTokenScale();
  if (!rawCss || !rawCss.includes('@theme')) {
    return scale;
  }

  // Strip CSS block comments before scanning `@theme` blocks
  const withoutComments = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const themeHeaderRegex = /@theme(?:\s+[^{]+)?\{/gi;
  let match: RegExpExecArray | null;

  while ((match = themeHeaderRegex.exec(withoutComments)) !== null) {
    const matchedHeader = match.at(0) ?? '';
    const bodyStart = match.index + matchedHeader.length;
    let depth = 1;
    let cursor = bodyStart;

    while (cursor < withoutComments.length && depth > 0) {
      const ch = withoutComments.charAt(cursor);
      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
      }
      cursor++;
    }

    if (depth !== 0) {
      continue;
    }

    const themeBody = withoutComments.slice(bodyStart, cursor - 1);
    const declRegex = /(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/g;
    let declMatch: RegExpExecArray | null;

    while ((declMatch = declRegex.exec(themeBody)) !== null) {
      const propName = declMatch.at(1) ?? '';
      const propValue = (declMatch.at(2) ?? '').trim();
      const classified = classifyAndNormalizeTokenValue(propName, propValue);
      if (classified) {
        scale[classified.category].push(classified.normalizedValue);
      }
    }
  }

  return mergeTokenScales(scale);
}


/**
 * Scans `cwd` (up to `maxDepth` subdirectories, respecting `BLOCKLIST_DIRECTORIES`) for:
 * - W3C Design Tokens (`*.tokens.json`) and Style Dictionary token JSON (`*tokens*.json`)
 * - Tailwind v4 `@theme` CSS files (`*.css`)
 * Returns a merged `ITokenScaleConfig` containing all discovered tokens.
 */
export function discoverWorkspaceTokens(cwd: string, maxDepth: number = 4): ITokenScaleConfig {
  const discoveredScales: ITokenScaleConfig[] = [];

  function scanDir(dirPath: string, depth: number): void {
    if (depth > maxDepth) {
      return;
    }

    let entries: string[];
    try {
      entries = readdirSync(dirPath);
    } catch {
      return;
    }

    for (const entryName of entries) {
      if (BLOCKLIST_DIRECTORIES.has(entryName)) {
        continue;
      }

      const fullPath = join(dirPath, entryName);
      let stats;
      try {
        stats = statSync(fullPath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        scanDir(fullPath, depth + 1);
        continue;
      }

      if (!stats.isFile()) {
        continue;
      }

      const lowerName = basename(entryName).toLowerCase();

      if (
        lowerName.endsWith('.tokens.json') ||
        (lowerName.endsWith('.json') &&
          lowerName.includes('token') &&
          lowerName !== 'package.json' &&
          lowerName !== 'package-lock.json' &&
          lowerName !== 'tsconfig.json')
      ) {
        try {
          const raw = readFileSync(fullPath, 'utf8');
          const parsedScale = parseW3cOrStyleDictionaryTokens(raw);
          if (
            parsedScale.colors.length > 0 ||
            parsedScale.spacing.length > 0 ||
            parsedScale.fontSizes.length > 0 ||
            parsedScale.radii.length > 0
          ) {
            discoveredScales.push(parsedScale);
          }
        } catch {
          // Ignore unreadable JSON files
        }
      } else if (lowerName.endsWith('.css')) {
        try {
          const raw = readFileSync(fullPath, 'utf8');
          if (raw.includes('@theme')) {
            const parsedCssScale = parseTailwindThemeCss(raw);
            if (
              parsedCssScale.colors.length > 0 ||
              parsedCssScale.spacing.length > 0 ||
              parsedCssScale.fontSizes.length > 0 ||
              parsedCssScale.radii.length > 0
            ) {
              discoveredScales.push(parsedCssScale);
            }
          }
        } catch {
          // Ignore unreadable CSS files
        }
      }
    }
  }

  scanDir(cwd, 0);
  return mergeTokenScales(...discoveredScales);
}
