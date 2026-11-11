/**
 * tests/unit/playground-fixtures.test.ts
 * 1-to-1 unit tests verifying the `playground/` HTML & TypeScript fixture structure,
 * AgnosticUI `--ag-*` token bindings, CLS trap injection, and ANSI colorized reporting.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { scheduleClsTrapInjection } from '../../playground/src/cls-trap.js';
import { formatSpotCheckSummary, type ISpotCheckReport } from '../../playground/src/spot-check.js';

describe('::: PHASE 4 TASK 4.3: PLAYGROUND BASELINE & ADVERSARIAL FIXTURES :::', () => {
  it('==> Should bind AgnosticUI --ag-* tokens and mount baseline components + adversarial traps in playground/index.html', () => {
    const htmlPath = resolve(process.cwd(), 'playground/index.html');
    const htmlSource = readFileSync(htmlPath, 'utf8');

    expect(htmlSource).toContain('var(--ag-background-primary)');
    expect(htmlSource).toContain('var(--ag-text-primary)');
    expect(htmlSource).toContain('var(--ag-space-4)');
    expect(htmlSource).toContain('var(--ag-space-6)');
    expect(htmlSource).toContain('var(--ag-radius-md)');
    expect(htmlSource).toContain('id="theme-toggle"');
    expect(htmlSource).toContain('<ag-card');
    expect(htmlSource).toContain('<ag-input');
    expect(htmlSource).toContain('<ag-button');
    expect(htmlSource).toContain('id="contrast-token-trap"');
    expect(htmlSource).toContain('id="overflow-trap-box"');
    expect(htmlSource).toContain('id="cls-trap-slot"');
  });

  it('==> Should import ag-tokens.css and ag-tokens-dark.css in playground/src/main.ts', () => {
    const mainPath = resolve(process.cwd(), 'playground/src/main.ts');
    const mainSource = readFileSync(mainPath, 'utf8');

    expect(mainSource).toContain('./components/ag/styles/ag-tokens.css');
    expect(mainSource).toContain('./components/ag/styles/ag-tokens-dark.css');
  });

  it('==> Should inject #late-unsized-banner styled with --ag-* tokens after delay to induce a layout shift', () => {
    vi.useFakeTimers();

    try {
      const appendedChildren: Array<{ id: string; textContent: string; style: Record<string, string> }> = [];
      const mockSlot = {
        appendChild: (node: { id: string; textContent: string; style: Record<string, string> }) => {
          appendedChildren.push(node);
          return node;
        },
      };

      const mockDoc = {
        getElementById: (id: string) => (id === 'cls-trap-slot' ? mockSlot : null),
        createElement: (_tag: string) => ({
          id: '',
          textContent: '',
          style: {} as Record<string, string>,
        }),
      } as unknown as Document;

      scheduleClsTrapInjection(mockDoc, 100);
      expect(appendedChildren.length).toBe(0);

      vi.advanceTimersByTime(150);

      expect(appendedChildren.length).toBe(1);
      const injectedBanner = appendedChildren[0];
      expect(injectedBanner).toBeDefined();
      expect(injectedBanner?.id).toBe('late-unsized-banner');
      expect(injectedBanner?.style.height).toBe('140px');
      expect(injectedBanner?.style.padding).toBe('var(--ag-space-4)');
      expect(injectedBanner?.style.backgroundColor).toBe('var(--ag-warning-background)');
      expect(injectedBanner?.style.color).toBe('var(--ag-warning-text)');
      expect(injectedBanner?.style.borderRadius).toBe('var(--ag-radius-lg)');
    } finally {
      vi.useRealTimers();
    }
  });

  it('==> Should format a color-coded terminal report and respect NO_COLOR', () => {
    const sampleReport: ISpotCheckReport = {
      lightMode: {
        tokenViolations: [
          {
            selector: 'div#contrast-token-trap',
            property: 'fontSize',
            actualValue: '13px',
            inShadowDom: false,
          },
        ],
        contrastViolations: [
          {
            selector: 'div#contrast-token-trap',
            foregroundRgb: 'rgb(156, 163, 175)',
            backgroundRgb: 'rgb(243, 244, 246)',
            contrastRatio: 2.54,
            inShadowDom: false,
          },
        ],
        stressViolations: [
          {
            violationType: 'container_overflow',
            selector: 'span#overflow-trap-label',
            relatedSelector: 'div#overflow-trap-box',
            measuredLeakPixels: 185,
            inShadowDom: false,
          },
        ],
        clsEvaluation: {
          maxSessionCls: 0.24,
          violation: {
            measuredClsScore: 0.24,
            clsMaxLimit: 0.1,
            shiftCountInWorstWindow: 1,
            offendingSelectors: ['main.sandbox-grid'],
          },
        },
      },
      darkMode: {
        activeThemeAttr: 'dark',
        contrastViolations: [],
      },
    };

    const previousNoColor = process.env.NO_COLOR;
    try {
      delete process.env.NO_COLOR;
      const coloredSummary = formatSpotCheckSummary(sampleReport);
      expect(coloredSummary).toContain('\x1b[');
      expect(coloredSummary).toContain('uirig Live 4-Tool Spot-Check Report');
      expect(coloredSummary).toContain('div#contrast-token-trap');
      expect(coloredSummary).toContain('2.54:1 < 4.5:1');
      expect(coloredSummary).toContain('+185px');
      expect(coloredSummary).toContain('FAIL (Shift Detected)');

      process.env.NO_COLOR = '1';
      const plainSummary = formatSpotCheckSummary(sampleReport);
      expect(plainSummary).not.toContain('\x1b[');
      expect(plainSummary).toContain('div#contrast-token-trap (fontSize: 13px)');
      expect(plainSummary).toContain('span#overflow-trap-label -> div#overflow-trap-box (+185px)');
    } finally {
      if (previousNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previousNoColor;
      }
    }
  });
});
