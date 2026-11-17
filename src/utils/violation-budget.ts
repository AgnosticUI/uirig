/**
 * src/utils/violation-budget.ts
 * Violation Priority Sorter & Output Limiter (Issue #15).
 *
 * What this file does:
 * 1. Scores and sorts UI violations from most important to least important so
 *    an AI agent fixes page-breaking layout bugs before minor styling cleanup.
 * 2. Trims the sorted list when `--top <n>` or `--max-tokens <budget>` is used,
 *    making sure the final JSON output is never cut off mid-object.
 */

import type { IAgenticViolation } from './agent-stream.js';
import { logTelemetry } from './formatter.js';

/** Rough rule of thumb for LLM token size: 1 token is about 4 characters of text. */
export const CHARS_PER_TOKEN_ESTIMATE = 4;

/** Approximate size in characters of the outer JSON wrapper (tool, summary, exitCode, etc.). */
export const DEFAULT_ENVELOPE_OVERHEAD_CHARS = 320;

/**
 * Options for trimming the violation list (`--top` and `--max-tokens`).
 */
export interface IViolationBudgetOptions {
  /** Keep only the first N highest-priority violations (`--top <n>`). */
  top?: number;
  /** Stop adding violations once the JSON output reaches roughly this many tokens (`--max-tokens <budget>`). */
  maxTokens?: number;
  /** Optional character size of the outer JSON wrapper when measuring exact budget. */
  basePayloadOverheadChars?: number;
}

/**
 * Output returned after sorting and trimming violations.
 */
export interface IViolationBudgetResult {
  /** The sorted violations that fit within `--top` and `--max-tokens`. */
  violations: Array<IAgenticViolation>;
  /** How many unique violations existed before trimming. */
  totalViolations: number;
  /** How many lower-priority violations were left out (`0` if nothing was trimmed). */
  truncatedCount: number;
}

/**
 * Estimates how many LLM tokens a string will take (roughly 1 token per 4 characters).
 */
export function estimateTokenCount(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * Assigns a simple priority number to a violation (higher number = fix first).
 *
 * Base points by category:
 * - 100 pts: `cls` (page jumping) or `runtime` (JavaScript crashes/errors).
 * -  80 pts: `stress` (clipped text, horizontal scrollbars, tiny tap targets).
 * -  70 pts: `dom` hidden prompt-injection text.
 * -  60 pts: `contrast` or `dark-mode` (hard-to-read colors).
 * -  40 pts: `tokens` (hardcoded colors/sizes instead of design tokens).
 * -  20 pts: `dom` (missing alt text, broken ARIA IDs, link cleanup).
 *
 * Tie-breaker:
 * - Adds up to +19 bonus points when a violation repeats across many elements
 *   (`occurrenceCount`), so a bug affecting 12 cards beats one affecting 1 card.
 */
export function scoreViolationPriority(violation: IAgenticViolation): number {
  let baseTierScore = 20;

  if (violation.engine === 'cls' || violation.engine === 'runtime') {
    baseTierScore = 100;
  } else if (violation.engine === 'stress') {
    baseTierScore = 80;
  } else if (
    violation.engine === 'dom' &&
    violation.violationType.toLowerCase().includes('prompt_injection')
  ) {
    baseTierScore = 70;
  } else if (violation.engine === 'contrast' || violation.engine === 'dark-mode') {
    baseTierScore = 60;
  } else if (violation.engine === 'tokens') {
    baseTierScore = 40;
  } else if (violation.engine === 'dom') {
    baseTierScore = 20;
  }

  // Cap the repeat bonus at 19 so a lower category never jumps ahead of a higher one.
  const normalizedOccurrences = Math.max(1, violation.occurrenceCount);
  const occurrenceBonus = Math.min(normalizedOccurrences - 1, 19);

  return baseTierScore + occurrenceBonus;
}
/**
 * Returns a copy of `violations` sorted from highest priority score to lowest.
 * If two violations tie on score, sorts alphabetically by viewport, selector,
 * and violation type so the order is always predictable.
 */
export function rankViolationsByBlastRadius(
  violations: ReadonlyArray<IAgenticViolation>
): Array<IAgenticViolation> {
  const scored = violations.map((violation) => ({
    violation,
    score: scoreViolationPriority(violation),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const vpCmp = a.violation.viewport.localeCompare(b.violation.viewport);
    if (vpCmp !== 0) {
      return vpCmp;
    }
    const selCmp = a.violation.selector.localeCompare(b.violation.selector);
    if (selCmp !== 0) {
      return selCmp;
    }
    return a.violation.violationType.localeCompare(b.violation.violationType);
  });

  return scored.map((entry) => entry.violation);
}

/**
 * Sorts violations by priority and trims the list to fit `--top` and `--max-tokens`.
 *
 * Why we pack items one by one for `--max-tokens`:
 * Cutting raw JSON text at a character limit would leave broken brackets and crash
 * the agent's JSON parser. Adding whole violation objects until the next one would
 * go over budget guarantees valid JSON every time.
 */
export function applyViolationBudget(
  violations: ReadonlyArray<IAgenticViolation>,
  options: IViolationBudgetOptions = {}
): IViolationBudgetResult {
  const totalViolations = violations.length;
  const ranked = rankViolationsByBlastRadius(violations);

  if (totalViolations === 0) {
    return {
      violations: new Array<IAgenticViolation>(),
      totalViolations: 0,
      truncatedCount: 0,
    };
  }

  // Step 1: Keep only the top N items if `--top` was requested.
  let candidateSlice = ranked;
  if (options.top !== undefined) {
    const safeTop = Math.max(0, Math.floor(options.top));
    candidateSlice = ranked.slice(0, safeTop);
  }

  // Step 2: Add items one by one until adding the next item would exceed `--max-tokens`.
  if (options.maxTokens !== undefined) {
    const safeMaxTokens = Math.max(0, Math.floor(options.maxTokens));
    if (safeMaxTokens === 0) {
      return {
        violations: new Array<IAgenticViolation>(),
        totalViolations,
        truncatedCount: totalViolations,
      };
    }

    const overheadChars =
      options.basePayloadOverheadChars ?? DEFAULT_ENVELOPE_OVERHEAD_CHARS;
    const packed = new Array<IAgenticViolation>();
    let runningChars = overheadChars;

    for (const item of candidateSlice) {
      // Measure this violation as pretty-printed JSON plus comma/newline spacing (~4 chars).
      const serializedItemChars = JSON.stringify(item, null, 2).length + 4;
      const projectedTokens = Math.ceil(
        (runningChars + serializedItemChars) / CHARS_PER_TOKEN_ESTIMATE
      );

      // Always keep at least 1 top violation when maxTokens > 0 so the agent sees the #1 bug.
      if (packed.length > 0 && projectedTokens > safeMaxTokens) {
        break;
      }

      packed.push(item);
      runningChars += serializedItemChars;
    }

    candidateSlice = packed;
  }

  const truncatedCount = totalViolations - candidateSlice.length;
  if (truncatedCount > 0) {
    logTelemetry(
      'budget:cap',
      `Kept ${candidateSlice.length}/${totalViolations} highest-priority violations (${truncatedCount} omitted)`
    );
  }

  return {
    violations: candidateSlice,
    totalViolations,
    truncatedCount,
  };
}
