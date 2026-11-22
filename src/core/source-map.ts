/**
 * src/core/source-map.ts
 * Framework Source-Map & `file:line` Attribution Engine (Issue #9).
 * Implements a zero-dependency Base64 VLQ (Variable-Length Quantity) Source Map v3 decoder
 * and framework dev-mode metadata resolver (`data-source-loc`, `data-loc`, `data-insp-path`).
 */

import { relative, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
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
  if (sourceRoot && sourceRoot.trim().length > 0 && !combined.startsWith('/') && !combined.includes('://')) {
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

  // Strip Vite/bundler query strings like `?t=12345` or `?direct`
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
