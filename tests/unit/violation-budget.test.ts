/**
 * tests/unit/violation-budget.test.ts
 * Unit tests for the Violation Priority Sorter & Output Limiter (`src/utils/violation-budget.ts`).
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokenCount,
  scoreViolationPriority,
  rankViolationsByBlastRadius,
  applyViolationBudget,
} from '../../src/utils/violation-budget.js';
import type { IAgenticViolation } from '../../src/utils/agent-stream.js';

function makeViolation(overrides: Partial<IAgenticViolation>): IAgenticViolation {
  return {
    engine: 'tokens',
    violationType: 'token_drift',
    url: 'http://localhost:5173',
    viewport: 'desktop (1440x900)',
    hostComponent: null,
    selector: 'div.card',
    inShadowDom: false,
    occurrenceCount: 1,
    measuredDelta: 'color: #3b82f6',
    remediationAdvice: 'Replace hardcoded color with design token.',
    ...overrides,
  };
}

describe('Violation Priority Sorter & Output Limiter (src/utils/violation-budget.ts)', () => {
  it('estimates token count at roughly 1 token per 4 characters', () => {
    console.log('[TEST] Checking character-to-token estimation...');
    expect(estimateTokenCount('')).toBe(0);
    expect(estimateTokenCount('abcd')).toBe(1);
    expect(estimateTokenCount('abcde')).toBe(2);
  });

  it('sorts violations from biggest page impact to smallest (CLS/Runtime > Stress > Contrast/Dark-Mode > Tokens > DOM)', () => {
    console.log('[TEST] Checking category priority order...');

    const domViolation = makeViolation({
      engine: 'dom',
      violationType: 'missing_alt',
      selector: 'img.hero',
    });
    const tokenViolation = makeViolation({
      engine: 'tokens',
      violationType: 'token_drift',
      selector: 'button.primary',
    });
    const contrastViolation = makeViolation({
      engine: 'contrast',
      violationType: 'contrast_drop',
      selector: 'p.subtitle',
    });
    const darkModeViolation = makeViolation({
      engine: 'dark-mode',
      violationType: 'stranded_light_surface',
      selector: 'section.banner',
    });
    const stressViolation = makeViolation({
      engine: 'stress',
      violationType: 'horizontal_scrollbar',
      selector: 'div.grid',
    });
    const clsViolation = makeViolation({
      engine: 'cls',
      violationType: 'cls_breach',
      selector: 'main.feed',
    });
    const runtimeViolation = makeViolation({
      engine: 'runtime',
      violationType: 'pageerror',
      selector: 'window',
    });

    const ranked = rankViolationsByBlastRadius([
      domViolation,
      tokenViolation,
      contrastViolation,
      darkModeViolation,
      stressViolation,
      clsViolation,
      runtimeViolation,
    ]);

    expect(ranked.map((v) => v.engine)).toEqual([
      'cls',
      'runtime',
      'stress',
      'contrast',
      'dark-mode',
      'tokens',
      'dom',
    ]);
  });

    it('puts repeating bugs (higher occurrenceCount) first when two violations tie on category', () => {
    console.log('[TEST] Checking repeat-count tie-breaker...');

    const singleCard = makeViolation({
      engine: 'contrast',
      selector: 'span.single',
      occurrenceCount: 1,
    });
    const twelveCards = makeViolation({
      engine: 'contrast',
      selector: 'span.repeated',
      occurrenceCount: 12,
    });

    expect(scoreViolationPriority(twelveCards)).toBeGreaterThan(
      scoreViolationPriority(singleCard)
    );

    const ranked = rankViolationsByBlastRadius([singleCard, twelveCards]);
    expect(ranked.at(0)?.selector).toBe('span.repeated');
    expect(ranked.at(1)?.selector).toBe('span.single');
  });

  it('keeps only the top N violations when --top is set', () => {
    console.log('[TEST] Checking --top count limit...');

    const violations = [
      makeViolation({ engine: 'dom', selector: 'img.a' }),
      makeViolation({ engine: 'tokens', selector: 'div.b' }),
      makeViolation({ engine: 'stress', selector: 'div.c' }),
      makeViolation({ engine: 'cls', selector: 'main.d' }),
    ];

    const result = applyViolationBudget(violations, { top: 2 });
    expect(result.totalViolations).toBe(4);
    expect(result.truncatedCount).toBe(2);
    expect(result.violations.map((v) => v.engine)).toEqual(['cls', 'stress']);
  });

  it('stops adding violations when the next one would exceed --max-tokens', () => {
    console.log('[TEST] Checking --max-tokens budget packing...');

    const violations = [
      makeViolation({ engine: 'cls', selector: 'main.layout-shift' }),
      makeViolation({ engine: 'stress', selector: 'div.overflow-box' }),
      makeViolation({ engine: 'contrast', selector: 'p.low-contrast' }),
      makeViolation({ engine: 'tokens', selector: 'span.raw-color' }),
    ];

    const result = applyViolationBudget(violations, { maxTokens: 180 });
    expect(result.totalViolations).toBe(4);
    expect(result.violations.length).toBe(1);
    expect(result.violations.at(0)?.engine).toBe('cls');
    expect(result.truncatedCount).toBe(3);
  });

  it('handles empty lists and zero token budgets cleanly', () => {
    console.log('[TEST] Checking empty and zero-budget edge cases...');

    expect(applyViolationBudget(new Array<IAgenticViolation>(), { top: 5 })).toEqual({
      violations: new Array<IAgenticViolation>(),
      totalViolations: 0,
      truncatedCount: 0,
    });

    const single = [makeViolation({ engine: 'cls' })];
    const zeroBudget = applyViolationBudget(single, { maxTokens: 0 });
    expect(zeroBudget.violations).toEqual(new Array<IAgenticViolation>());
    expect(zeroBudget.truncatedCount).toBe(1);
  });
});
