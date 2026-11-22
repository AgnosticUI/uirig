/**
 * tests/unit/auto-tokens.test.ts
 * Unit specs for zero-config design token classification, normalization,
 * workspace file discovery (W3C .tokens.json, Style Dictionary, Tailwind v4 @theme),
 * and scale merging.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  classifyAndNormalizeTokenValue,
  discoverWorkspaceTokens,
  mergeTokenScales,
  normalizeCssColorToken,
  normalizeCssLengthToPx,
  parseTailwindThemeCss,
  parseW3cOrStyleDictionaryTokens,
} from '../../src/core/auto-tokens.js';

describe('::: ISSUE #10 (CHUNKS 1–2): TOKEN CLASSIFIER & WORKSPACE FILE DISCOVERY :::', () => {
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

    it('==> Should parse W3C Design Tokens ($value) and Style Dictionary (value) JSON trees', () => {
    const w3cJson = JSON.stringify({
      $schema: 'https://designtokens.org',
      color: {
        brand: {
          primary: { $value: '#2563eb', $type: 'color' },
          surface: { $value: '#ffffff', $type: 'color' },
        },
      },
      spacing: {
        sm: { $value: '0.5rem', $type: 'dimension' },
        md: { $value: '1rem', $type: 'dimension' },
      },
      font: {
        size: {
          body: { $value: '16px', $type: 'dimension' },
        },
      },
      radius: {
        card: { $value: '8px', $type: 'dimension' },
      },
    });

    expect(parseW3cOrStyleDictionaryTokens(w3cJson)).toEqual({
      colors: ['rgb(37, 99, 235)', 'rgb(255, 255, 255)'],
      spacing: ['8px', '16px', '0px'],
      fontSizes: ['16px'],
      radii: ['8px', '0px'],
    });

    const styleDictionaryJson = JSON.stringify({
      color: {
        text: {
          primary: { value: '#0f172a' },
        },
      },
      size: {
        padding: {
          base: { value: '12px' },
        },
      },
    });

    expect(parseW3cOrStyleDictionaryTokens(styleDictionaryJson)).toEqual({
      colors: ['rgb(15, 23, 42)'],
      spacing: ['12px', '0px'],
      fontSizes: [],
      radii: [],
    });
  });

  it('==> Should parse Tailwind v4 @theme blocks from CSS stylesheets', () => {
    const tailwindCss = [
      '@import "tailwindcss";',
      '/* comment ignored */',
      '@theme {',
      '  --color-primary: #2563eb;',
      '  --color-ink: #0f172a;',
      '  --spacing-md: 1rem;',
      '  --text-base: 16px;',
      '  --radius-lg: 0.75rem;',
      '  --font-sans: "Inter", sans-serif;',
      '}',
    ].join('\n');

    expect(parseTailwindThemeCss(tailwindCss)).toEqual({
      colors: ['rgb(37, 99, 235)', 'rgb(15, 23, 42)'],
      spacing: ['16px', '0px'],
      fontSizes: ['16px'],
      radii: ['12px', '0px'],
    });
  });

  it('==> Should auto-discover tokens across W3C .tokens.json and Tailwind v4 CSS files in a workspace', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-autotokens-ws-'));

    try {
      mkdirSync(join(tempDir, 'src', 'styles'), { recursive: true });
      mkdirSync(join(tempDir, 'node_modules', 'ignored-pkg'), { recursive: true });

      writeFileSync(
        join(tempDir, 'design.tokens.json'),
        JSON.stringify({
          color: { accent: { $value: '#16a34a' } },
          spacing: { lg: { $value: '24px' } },
        }),
        'utf8'
      );

      writeFileSync(
        join(tempDir, 'src', 'styles', 'theme.css'),
        '@theme { --color-canvas: #ffffff; --radius-pill: 9999px; --text-sm: 14px; }',
        'utf8'
      );

      // Blocklisted node_modules tokens must be ignored
      writeFileSync(
        join(tempDir, 'node_modules', 'ignored-pkg', 'leak.tokens.json'),
        JSON.stringify({ color: { leak: { $value: '#ff00ff' } } }),
        'utf8'
      );

      const discovered = discoverWorkspaceTokens(tempDir);

      expect(discovered.colors).toContain('rgb(22, 163, 74)');
      expect(discovered.colors).toContain('rgb(255, 255, 255)');
      expect(discovered.colors).not.toContain('rgb(255, 0, 255)');
      expect(discovered.spacing).toEqual(['24px', '0px']);
      expect(discovered.fontSizes).toEqual(['14px']);
      expect(discovered.radii).toEqual(['9999px', '0px']);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
