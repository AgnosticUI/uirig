/**
 * tests/unit/auto-tokens.test.ts
 * Unit specs for zero-config design token classification, normalization, and scale merging.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyAndNormalizeTokenValue,
  mergeTokenScales,
  normalizeCssColorToken,
  normalizeCssLengthToPx,
} from '../../src/core/auto-tokens.js';

describe('::: ISSUE #10 (CHUNK 1): TOKEN VALUE CLASSIFIER & SCALE MERGER :::', () => {
  it('==> Should normalize hex, rgb/rgba, hsl, and oklch colors to computed rgb/rgba strings', () => {
    expect(normalizeCssColorToken('#2563eb')).toBe('rgb(37, 99, 235)');
    expect(normalizeCssColorToken('hsl(222, 47%, 11%)')).toBe('rgb(15, 23, 41)');
    expect(normalizeCssColorToken('rgba(15, 23, 42, 0.5)')).toBe('rgba(15, 23, 42, 0.5)');
    expect(normalizeCssColorToken('oklch(0.623 0.214 259.815)')).toMatch(/^rgb\(\d+, \d+, \d+\)$/);

    // Non-color tokens return null
    expect(normalizeCssColorToken('16px')).toBeNull();
    expect(normalizeCssColorToken('1.5rem')).toBeNull();
    expect(normalizeCssColorToken('var(--color-primary)')).toBeNull();
    expect(normalizeCssColorToken('0 1px 2px rgba(0, 0, 0, 0.1)')).toBeNull();
  });

  it('==> Should convert px, rem, em, and 0 lengths into pixel strings', () => {
    expect(normalizeCssLengthToPx('0')).toBe('0px');
    expect(normalizeCssLengthToPx('12px')).toBe('12px');
    expect(normalizeCssLengthToPx('1rem')).toBe('16px');
    expect(normalizeCssLengthToPx('0.875rem')).toBe('14px');
    expect(normalizeCssLengthToPx('1.5em')).toBe('24px');

    expect(normalizeCssLengthToPx('-4px')).toBeNull();
    expect(normalizeCssLengthToPx('100%')).toBeNull();
    expect(normalizeCssLengthToPx('auto')).toBeNull();
  });

  it('==> Should classify token names and values into colors, spacing, fontSizes, and radii buckets', () => {
    expect(classifyAndNormalizeTokenValue('--color-brand-primary', '#0f172a')).toEqual({
      category: 'colors',
      normalizedValue: 'rgb(15, 23, 42)',
    });

    expect(classifyAndNormalizeTokenValue('--spacing-4', '1rem')).toEqual({
      category: 'spacing',
      normalizedValue: '16px',
    });

    expect(classifyAndNormalizeTokenValue('--text-lg', '1.125rem')).toEqual({
      category: 'fontSizes',
      normalizedValue: '18px',
    });

    expect(classifyAndNormalizeTokenValue('--radius-card', '0.5rem')).toEqual({
      category: 'radii',
      normalizedValue: '8px',
    });

    expect(classifyAndNormalizeTokenValue('--font-sans', 'Inter, sans-serif')).toBeNull();
    expect(classifyAndNormalizeTokenValue('--z-modal', '50')).toBeNull();
  });

  it('==> Should merge and deduplicate multiple token scales while guaranteeing 0px in spacing and radii', () => {
    const merged = mergeTokenScales(
      {
        colors: ['rgb(15, 23, 42)', 'rgb(255, 255, 255)'],
        spacing: ['8px', '16px'],
        fontSizes: ['14px'],
        radii: ['4px'],
      },
      {
        colors: ['rgb(255, 255, 255)', 'rgb(37, 99, 235)'],
        spacing: ['16px', '24px'],
        fontSizes: ['14px', '16px'],
        radii: ['8px'],
      }
    );

    expect(merged).toEqual({
      colors: ['rgb(15, 23, 42)', 'rgb(255, 255, 255)', 'rgb(37, 99, 235)'],
      spacing: ['8px', '16px', '24px', '0px'],
      fontSizes: ['14px', '16px'],
      radii: ['4px', '8px', '0px'],
    });
  });
});
