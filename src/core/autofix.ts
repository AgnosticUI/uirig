/**
 * src/core/autofix.ts
 * Deterministic Auto-Fix Patch Generator & Safe Disk Applier (Issue #13).
 * Generates standard unified diffs (`unifiedDiff`) for unambiguous 1-to-1 token and DOM
 * hygiene defects when `sourceFile` and `lineNumber` are resolved inside `cwd`, and
 * safely applies non-overlapping line patches when `--fix` is explicitly passed.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { isAbsolute, relative, resolve } from 'path';
import type { IAgenticViolation } from '../utils/agent-stream.js';

export interface IDeterministicAutoFix {
  /** Workspace-relative target file path. */
  sourceFile: string;
  /** 1-based target line number in `sourceFile`. */
  lineNumber: number;
  /** Exact original line text (without trailing newline). */
  originalLine: string;
  /** Exact patched line text (without trailing newline). */
  updatedLine: string;
  /** Standard unified diff string (`--- a/...`, `+++ b/...`, `@@ ... @@`). */
  unifiedDiff: string;
}

const INELIGIBLE_ENGINES = new Set<string>(['stress', 'cls', 'runtime']);

/**
 * Resolves `sourceFile` inside `cwd` and returns the absolute path only if it exists
 * on disk and stays strictly within `cwd` (preventing path traversal outside workspace).
 */
export function resolveSafeWorkspaceFilePath(
  sourceFile: string | null | undefined,
  cwd: string
): string | null {
  if (!sourceFile || sourceFile.trim().length === 0) {
    return null;
  }

  const trimmed = sourceFile.trim();
  const absTarget = isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed);
  const relToCwd = relative(cwd, absTarget);

  if (relToCwd.startsWith('..') || isAbsolute(relToCwd) || relToCwd.length === 0) {
    return null;
  }

  if (!existsSync(absTarget)) {
    return null;
  }

  return absTarget;
}

/**
 * Formats a single-line replacement as a standard unified diff.
 */
export function formatSingleLineUnifiedDiff(
  relFilePath: string,
  lineNumber: number,
  originalLine: string,
  updatedLine: string
): string {
  const normalizedPath = relFilePath.replace(/\\/g, '/');
  return [
    '--- a/' + normalizedPath,
    '+++ b/' + normalizedPath,
    '@@ -' + String(lineNumber) + ',1 +' + String(lineNumber) + ',1 @@',
    '-' + originalLine,
    '+' + updatedLine,
  ].join('\n');
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceSingleUnambiguousOccurrence(
  line: string,
  needle: string,
  replacement: string
): string | null {
  if (!needle || needle === replacement) {
    return null;
  }
  const regex = new RegExp(escapeRegExp(needle), 'g');
  const matches = line.match(regex);
  if (!matches || matches.length !== 1) {
    return null;
  }
  return line.replace(needle, replacement);
}

/**
 * Computes a deterministic 1-to-1 `IDeterministicAutoFix` for an `IAgenticViolation`
 * when `sourceFile` and `lineNumber` are resolved inside `cwd` and the fix is
 * completely unambiguous. Returns `null` for structural/layout violations or ambiguous lines.
 */
export function computeDeterministicAutoFix(
  violation: Pick<
    IAgenticViolation,
    'engine' | 'violationType' | 'sourceFile' | 'lineNumber' | 'measuredDelta' | 'suggestedToken'
  >,
  cwd: string
): IDeterministicAutoFix | null {
  if (INELIGIBLE_ENGINES.has(violation.engine)) {
    return null;
  }

  const lineNumber = violation.lineNumber;
  if (typeof lineNumber !== 'number' || !Number.isInteger(lineNumber) || lineNumber <= 0) {
    return null;
  }

  const absPath = resolveSafeWorkspaceFilePath(violation.sourceFile, cwd);
  if (!absPath || !violation.sourceFile) {
    return null;
  }

  let fileText: string;
  try {
    fileText = readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }

  const lines = fileText.split(/\r?\n/);
  if (lineNumber > lines.length) {
    return null;
  }

  const originalLine = lines[lineNumber - 1] ?? '';
  if (originalLine.length === 0 || originalLine.length > 500) {
    // Refuse empty or minified single-line bundles
    return null;
  }

  let updatedLine: string | null = null;

  // 1. Token drift with suggestedToken (`measuredDelta` format: "<property>: <actualValue>")
  if (violation.violationType === 'token_drift' && violation.suggestedToken) {
    const colonIdx = violation.measuredDelta.indexOf(':');
    const actualVal =
      colonIdx >= 0 ? violation.measuredDelta.slice(colonIdx + 1).trim() : '';
    if (actualVal.length > 0) {
      const tokenExpr = violation.suggestedToken.startsWith('var(')
        ? violation.suggestedToken
        : 'var(' + violation.suggestedToken + ')';
      updatedLine = replaceSingleUnambiguousOccurrence(originalLine, actualVal, tokenExpr);
    }
  } else if (
    (violation.engine === 'contrast' || violation.engine === 'dark-mode') &&
    violation.suggestedToken
  ) {
    // 2. Contrast / dark-mode color with `suggestedToken`: replace single CSS color literal on line
    const tokenExpr = violation.suggestedToken.startsWith('var(')
      ? violation.suggestedToken
      : 'var(' + violation.suggestedToken + ')';
    const colorMatches = originalLine.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)/g);
    if (colorMatches && colorMatches.length === 1 && colorMatches[0]) {
      updatedLine = replaceSingleUnambiguousOccurrence(originalLine, colorMatches[0], tokenExpr);
    }
  } else if (violation.violationType === 'broken_image') {
    // 3. Missing `alt` attribute on `<img ...>` tag
    const imgTags = originalLine.match(/<img\b[^>]*>/gi);
    if (imgTags && imgTags.length === 1 && imgTags[0] && !/\balt\s*=/i.test(imgTags[0])) {
      const patchedImg = imgTags[0].replace(/^<img\b/i, '<img alt=""');
      updatedLine = originalLine.replace(imgTags[0], patchedImg);
    }
  } else if (violation.violationType === 'unsafe_uri') {
    // 4. Unsafe `href="javascript:..."` URI -> `href="#"`
    const jsHrefMatches = originalLine.match(/href\s*=\s*(["'])javascript:[^"']*\1/gi);
    if (jsHrefMatches && jsHrefMatches.length === 1 && jsHrefMatches[0]) {
      updatedLine = originalLine.replace(jsHrefMatches[0], 'href="#"');
    }
  }

  if (!updatedLine || updatedLine === originalLine) {
    return null;
  }

  const relPath = relative(cwd, absPath).replace(/\\/g, '/');
  return {
    sourceFile: relPath,
    lineNumber,
    originalLine,
    updatedLine,
    unifiedDiff: formatSingleLineUnifiedDiff(relPath, lineNumber, originalLine, updatedLine),
  };
}

/**
 * Applies a batch of deterministic single-line fixes safely to disk inside `cwd`.
 * Deduplicates identical `(sourceFile, lineNumber)` entries and skips conflicting edits
 * targeting the exact same line with different replacements. Returns the list of applied fixes.
 */
export function applyDeterministicAutoFixes(
  fixes: ReadonlyArray<IDeterministicAutoFix>,
  cwd: string
): Array<IDeterministicAutoFix> {
  const byFile = new Map<string, Map<number, IDeterministicAutoFix>>();
  const conflictedKeys = new Set<string>();

  for (const fix of fixes) {
    const absPath = resolveSafeWorkspaceFilePath(fix.sourceFile, cwd);
    if (!absPath) {
      continue;
    }
    const key = absPath + '::' + String(fix.lineNumber);
    if (conflictedKeys.has(key)) {
      continue;
    }

    let lineMap = byFile.get(absPath);
    if (!lineMap) {
      lineMap = new Map<number, IDeterministicAutoFix>();
      byFile.set(absPath, lineMap);
    }

    const existing = lineMap.get(fix.lineNumber);
    if (!existing) {
      lineMap.set(fix.lineNumber, fix);
    } else if (existing.updatedLine !== fix.updatedLine) {
      // Conflicting replacements on the same line -> refuse both
      lineMap.delete(fix.lineNumber);
      conflictedKeys.add(key);
    }
  }

  const applied = new Array<IDeterministicAutoFix>();

  for (const [absPath, lineMap] of byFile.entries()) {
    if (lineMap.size === 0) {
      continue;
    }
    const rawText = readFileSync(absPath, 'utf8');
    const newline = rawText.includes('\r\n') ? '\r\n' : '\n';
    const lines = rawText.split(/\r?\n/);
    let fileChanged = false;

    for (const [lineNum, fix] of lineMap.entries()) {
      const idx = lineNum - 1;
      if (idx >= 0 && idx < lines.length && lines[idx] === fix.originalLine) {
        lines[idx] = fix.updatedLine;
        applied.push(fix);
        fileChanged = true;
      }
    }

    if (fileChanged) {
      writeFileSync(absPath, lines.join(newline), 'utf8');
    }
  }

  return applied;
}
