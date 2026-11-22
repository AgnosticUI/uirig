/**
 * src/core/source-map.ts
 * Framework Source-Map & `file:line` Attribution Engine (Issue #9).
 * Implements a zero-dependency Base64 VLQ (Variable-Length Quantity) Source Map v3 decoder,
 * framework dev-mode metadata resolver (`data-source-loc`, `data-loc`, `data-insp-path`),
 * and live Chromium CDP (Chrome DevTools Protocol) `CSS.getMatchedStylesForNode` resolver.
 */

import { existsSync, readFileSync } from 'fs';
import { relative, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import type { Page } from 'playwright';
import type { ISourceLocation } from '../interfaces/locator.js';

export interface IRawSourceMapV3 {
  version?: number;
  file?: string;
  sourceRoot?: string;
  sources: Array<string>;
  sourcesContent?: Array<string | null>;
  names?: Array<string>;
  mappings: string;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_CHAR_TO_INT = new Map<string, number>(
  Array.from(BASE64_ALPHABET).map((ch, idx) => [ch, idx])
);

const VLQ_BASE_SHIFT = 5;
const VLQ_BASE = 1 << VLQ_BASE_SHIFT; // 32
const VLQ_BASE_MASK = VLQ_BASE - 1; // 31
const VLQ_CONTINUATION_BIT = VLQ_BASE; // 32

/**
 * Decodes a single Base64 VLQ segment (up to 5 integer fields) starting at `startIndex`.
 */
export function decodeVlqSegment(
  mappings: string,
  startIndex: number
): { values: Array<number>; nextIndex: number } | null {
  const values = new Array<number>();
  let index = startIndex;

  while (index < mappings.length) {
    const ch = mappings.charAt(index);
    if (ch === ',' || ch === ';') {
      break;
    }

    let result = 0;
    let shift = 0;
    let continuation = true;

    while (continuation) {
      if (index >= mappings.length) {
        return null;
      }
      const digitChar = mappings.charAt(index);
      index++;
      const digit = BASE64_CHAR_TO_INT.get(digitChar);
      if (digit === undefined) {
        return null;
      }
      continuation = (digit & VLQ_CONTINUATION_BIT) !== 0;
      const chunk = digit & VLQ_BASE_MASK;
      result += chunk << shift;
      shift += VLQ_BASE_SHIFT;
    }

    const isNegative = (result & 1) === 1;
    const magnitude = result >> 1;
    values.push(isNegative ? -magnitude : magnitude);
  }

  return { values, nextIndex: index };
}

/**
 * Normalizes a resolved source path (handling `file://` URLs, Vite `/@fs/` prefixes,
 * and `sourceRoot` prefixes) into a clean workspace-relative path when inside `cwd`.
 */
export function normalizeResolvedSourcePath(
  rawSource: string,
  cwd: string,
  sourceRoot?: string
): string {
  let combined = rawSource.trim();
  if (
    sourceRoot &&
    sourceRoot.trim().length > 0 &&
    !combined.startsWith('/') &&
    !combined.includes('://')
  ) {
    const cleanRoot = sourceRoot.trim().replace(/\/+$/, '');
    combined = cleanRoot + '/' + combined.replace(/^\/+/, '');
  }

  if (combined.startsWith('file://')) {
    try {
      combined = fileURLToPath(combined);
    } catch {
      combined = combined.slice('file://'.length);
    }
  } else if (combined.startsWith('/@fs/')) {
    combined = combined.slice('/@fs'.length);
  }

  const queryIdx = combined.indexOf('?');
  if (queryIdx >= 0) {
    combined = combined.slice(0, queryIdx);
  }

  if (isAbsolute(combined)) {
    const rel = relative(cwd, combined);
    if (!rel.startsWith('..') && !isAbsolute(rel)) {
      return rel.replace(/\\/g, '/');
    }
    return combined.replace(/\\/g, '/');
  }

  const resolvedFromCwd = resolve(cwd, combined);
  const relFromCwd = relative(cwd, resolvedFromCwd);
  return (!relFromCwd.startsWith('..') ? relFromCwd : combined).replace(/\\/g, '/');
}

/**
 * Parses an inline `data:application/json;base64,...` (or UTF-8 data URI) or raw JSON
 * Source Map v3 string into `IRawSourceMapV3`. Returns `null` if invalid or corrupt.
 */
export function parseRawSourceMap(rawInput: string): IRawSourceMapV3 | null {
  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let jsonText = trimmed;
  if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx < 0) {
      return null;
    }
    const header = trimmed.slice(0, commaIdx).toLowerCase();
    const payload = trimmed.slice(commaIdx + 1);
    try {
      jsonText = header.includes(';base64')
        ? Buffer.from(payload, 'base64').toString('utf8')
        : decodeURIComponent(payload);
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<IRawSourceMapV3>;
    if (!Array.isArray(parsed.sources) || typeof parsed.mappings !== 'string') {
      return null;
    }
    return {
      version: parsed.version,
      file: parsed.file,
      sourceRoot: parsed.sourceRoot,
      sources: parsed.sources,
      sourcesContent: parsed.sourcesContent,
      names: parsed.names,
      mappings: parsed.mappings,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves a 0-based `(generatedLine, generatedColumn)` position against a parsed
 * Source Map v3 object and returns 1-based `{ sourceFile, lineNumber, columnNumber }`.
 */
export function resolveOriginalPositionFromSourceMap(
  sourceMap: IRawSourceMapV3,
  generatedLine0: number,
  generatedColumn0: number,
  cwd: string
): ISourceLocation | null {
  if (generatedLine0 < 0 || sourceMap.sources.length === 0) {
    return null;
  }

  const lines = sourceMap.mappings.split(';');
  let sourceIndex = 0;
  let originalLine0 = 0;
  let originalColumn0 = 0;

  let bestMatch: {
    sourceIndex: number;
    originalLine0: number;
    originalColumn0: number;
  } | null = null;

  const maxLineToScan = Math.min(generatedLine0, lines.length - 1);

  for (let lineIdx = 0; lineIdx <= maxLineToScan; lineIdx++) {
    const lineStr = lines[lineIdx] ?? '';
    let generatedCol0 = 0;
    let cursor = 0;

    while (cursor < lineStr.length) {
      if (lineStr.charAt(cursor) === ',') {
        cursor++;
        continue;
      }

      const decoded = decodeVlqSegment(lineStr, cursor);
      if (!decoded || decoded.values.length === 0) {
        return null;
      }
      cursor = decoded.nextIndex;
      if (cursor < lineStr.length && lineStr.charAt(cursor) === ',') {
        cursor++;
      }

      generatedCol0 += decoded.values[0] ?? 0;

      if (decoded.values.length >= 4) {
        sourceIndex += decoded.values[1] ?? 0;
        originalLine0 += decoded.values[2] ?? 0;
        originalColumn0 += decoded.values[3] ?? 0;

        if (lineIdx === generatedLine0) {
          if (generatedCol0 <= generatedColumn0 || bestMatch === null) {
            bestMatch = {
              sourceIndex,
              originalLine0,
              originalColumn0,
            };
          }
          if (generatedCol0 > generatedColumn0) {
            break;
          }
        }
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  const rawSource = sourceMap.sources[bestMatch.sourceIndex];
  if (!rawSource) {
    return null;
  }

  return {
    sourceFile: normalizeResolvedSourcePath(rawSource, cwd, sourceMap.sourceRoot),
    lineNumber: bestMatch.originalLine0 + 1,
    columnNumber: bestMatch.originalColumn0 + 1,
  };
}

/**
 * Parses framework dev-mode source location attributes such as:
 * - `data-source-loc="src/components/Card.tsx:42:10"`
 * - `data-loc="src/App.svelte:18"`
 */
export function parseDevSourceLocationAttribute(
  rawAttr: string | null | undefined,
  cwd: string
): ISourceLocation | null {
  if (!rawAttr || rawAttr.trim().length === 0) {
    return null;
  }

  const trimmed = rawAttr.trim();
  const match = /^(.*?):(\d+)(?::(\d+))?$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const rawPath = (match[1] ?? '').trim();
  const lineNum = Number.parseInt(match[2] ?? '', 10);
  const colNum = match[3] ? Number.parseInt(match[3], 10) : 1;

  if (!rawPath || !Number.isFinite(lineNum) || lineNum <= 0) {
    return null;
  }

  return {
    sourceFile: normalizeResolvedSourcePath(rawPath, cwd),
    lineNumber: lineNum,
    columnNumber: Number.isFinite(colNum) && colNum > 0 ? colNum : 1,
  };
}

interface ICdpStyleSheetHeader {
  styleSheetId: string;
  sourceURL?: string;
  sourceMapURL?: string;
  origin?: string;
}

interface ICdpMatchedRuleEntry {
  rule?: {
    origin?: string;
    style?: {
      styleSheetId?: string;
      range?: {
        startLine?: number;
        startColumn?: number;
      };
    };
  };
}

async function loadSourceMapForStyleSheet(
  header: ICdpStyleSheetHeader,
  cache: Map<string, IRawSourceMapV3 | null>
): Promise<IRawSourceMapV3 | null> {
  if (cache.has(header.styleSheetId)) {
    return cache.get(header.styleSheetId) ?? null;
  }

  const rawMapUrl = (header.sourceMapURL ?? '').trim();
  if (!rawMapUrl) {
    cache.set(header.styleSheetId, null);
    return null;
  }

  if (rawMapUrl.startsWith('data:')) {
    const parsed = parseRawSourceMap(rawMapUrl);
    cache.set(header.styleSheetId, parsed);
    return parsed;
  }

  try {
    const baseUrl =
      header.sourceURL && header.sourceURL.trim().length > 0 ? header.sourceURL : undefined;
    const resolvedUrl = baseUrl ? new URL(rawMapUrl, baseUrl).toString() : rawMapUrl;

    if (resolvedUrl.startsWith('file://')) {
      const diskPath = fileURLToPath(resolvedUrl);
      if (!existsSync(diskPath)) {
        cache.set(header.styleSheetId, null);
        return null;
      }
      const parsed = parseRawSourceMap(readFileSync(diskPath, 'utf8'));
      cache.set(header.styleSheetId, parsed);
      return parsed;
    }

    if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
      const resp = await fetch(resolvedUrl);
      if (!resp.ok) {
        cache.set(header.styleSheetId, null);
        return null;
      }
      const parsed = parseRawSourceMap(await resp.text());
      cache.set(header.styleSheetId, parsed);
      return parsed;
    }
  } catch {
    // Graceful fallback when external source map cannot be fetched or read
  }

  cache.set(header.styleSheetId, null);
  return null;
}

/**
 * Resolves original `ISourceLocation` (`sourceFile`, `lineNumber`, `columnNumber`) for
 * a list of piercing CSS/Shadow-DOM violation selectors on a live Playwright `Page` via:
 * 1. Framework dev-mode DOM attributes (`data-source-loc`, `data-loc`, `data-insp-path`).
 * 2. CDP `CSS.getMatchedStylesForNode` + `CSS.styleSheetAdded` inline/external `.map` decoding.
 * Falls back cleanly to `null` when source maps are absent (production builds).
 */
export async function resolveViolationSourceLocations(
  page: Page,
  selectors: ReadonlyArray<string>,
  cwd: string
): Promise<Map<string, ISourceLocation | null>> {
  const uniqueSelectors = Array.from(new Set(selectors.filter((s) => s.trim().length > 0)));
  const resultMap = new Map<string, ISourceLocation | null>();
  if (uniqueSelectors.length === 0) {
    return resultMap;
  }

  const cdp = await page.context().newCDPSession(page);
  const styleSheetsById = new Map<string, ICdpStyleSheetHeader>();
  const parsedMapCache = new Map<string, IRawSourceMapV3 | null>();

  const onStyleSheetAdded = (params: { header?: ICdpStyleSheetHeader }): void => {
    if (params.header && params.header.styleSheetId) {
      styleSheetsById.set(params.header.styleSheetId, params.header);
    }
  };

  cdp.on('CSS.styleSheetAdded', onStyleSheetAdded);

  try {
    await cdp.send('DOM.enable');
    await cdp.send('DOM.getDocument', { depth: 0 });
    await cdp.send('CSS.enable');

    for (const sel of uniqueSelectors) {
      if (sel === 'document' || sel === 'window') {
        resultMap.set(sel, null);
        continue;
      }

      const evalRes = (await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const selPath = ${JSON.stringify(sel)};
          const normalized = selPath.replace(/::shadow\\s*>\\s*/g, ' >> shadow-root >> ');
          const segments = normalized.split('>> shadow-root >>').map((s) => s.trim()).filter(Boolean);
          let root = document;
          let found = null;
          for (let i = 0; i < segments.length; i++) {
            try { found = root.querySelector(segments[i]); } catch { return null; }
            if (!found) return null;
            if (i < segments.length - 1) {
              if (!found.shadowRoot) return null;
              root = found.shadowRoot;
            }
          }
          return found;
        })()`,
        returnByValue: false,
      })) as { result?: { objectId?: string; subtype?: string } };

      const objectId = evalRes.result?.objectId;
      if (!objectId || evalRes.result?.subtype !== 'node') {
        resultMap.set(sel, null);
        continue;
      }

      try {
        // 1. Check composed ancestors for dev-mode source location attributes
        const attrRes = (await cdp.send('Runtime.callFunctionOn', {
          objectId,
          functionDeclaration: `function() {
            let cur = this;
            while (cur) {
              const raw = cur.getAttribute && (
                cur.getAttribute('data-source-loc') ||
                cur.getAttribute('data-loc') ||
                cur.getAttribute('data-insp-path')
              );
              if (raw && raw.trim()) return raw.trim();
              if (cur.parentElement) {
                cur = cur.parentElement;
              } else {
                const r = cur.getRootNode && cur.getRootNode();
                cur = r && r.host ? r.host : null;
              }
            }
            return null;
          }`,
          returnByValue: true,
        })) as { result?: { value?: string | null } };

        const devLoc = parseDevSourceLocationAttribute(attrRes.result?.value, cwd);
        if (devLoc) {
          resultMap.set(sel, devLoc);
          continue;
        }

        // 2. Query CDP matched CSS rules and resolve via Source Map v3
        const domNode = (await cdp.send('DOM.requestNode', { objectId })) as { nodeId?: number };
        if (!domNode.nodeId) {
          resultMap.set(sel, null);
          continue;
        }

        const matched = (await cdp.send('CSS.getMatchedStylesForNode', {
          nodeId: domNode.nodeId,
        })) as { matchedCSSRules?: Array<ICdpMatchedRuleEntry> };

        const matchedRules = matched.matchedCSSRules ?? new Array<ICdpMatchedRuleEntry>();
        let resolvedLocation: ISourceLocation | null = null;

        for (let idx = matchedRules.length - 1; idx >= 0; idx--) {
          const entry = matchedRules[idx];
          const rule = entry?.rule;
          if (!rule || rule.origin !== 'regular') {
            continue;
          }
          const sheetId = rule.style?.styleSheetId;
          const range = rule.style?.range;
          if (!sheetId || !range || typeof range.startLine !== 'number') {
            continue;
          }

          const header = styleSheetsById.get(sheetId);
          if (!header) {
            continue;
          }

          const parsedMap = await loadSourceMapForStyleSheet(header, parsedMapCache);
          if (parsedMap) {
            resolvedLocation = resolveOriginalPositionFromSourceMap(
              parsedMap,
              range.startLine,
              range.startColumn ?? 0,
              cwd
            );
            if (resolvedLocation) {
              break;
            }
          }
        }

        resultMap.set(sel, resolvedLocation);
      } catch {
        resultMap.set(sel, null);
      } finally {
        try {
          await cdp.send('Runtime.releaseObject', { objectId });
        } catch {
          // Ignore object release errors
        }
      }
    }
  } finally {
    cdp.off('CSS.styleSheetAdded', onStyleSheetAdded);
    try {
      await cdp.detach();
    } catch {
      // Ignore detach errors
    }
  }

  return resultMap;
}
