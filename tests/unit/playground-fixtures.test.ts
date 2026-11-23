/**
 * tests/unit/playground-fixtures.test.ts
 * 1-to-1 unit tests verifying the `playground/` HTML & TypeScript fixture structure,
 * AgnosticUI `--ag-*` token bindings, CLS trap injection, and ANSI colorized reporting.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { scheduleClsTrapInjection } from '../../playground/src/cls-trap.js';
import { formatSpotCheckSummary, type ISpotCheckReport } from '../../playground/src/check.js';

describe('::: PHASE 4 TASK 4.3: PLAYGROUND BASELINE & ADVERSARIAL FIXTURES :::', () => {
  it('==> Should bind AgnosticUI --ag-* tokens and mount baseline components + adversarial traps in playground/index.html', () => {
    const htmlPath = resolve(process.cwd(), 'playground/index.html');
    const htmlSource = readFileSync(htmlPath, 'utf8');

    expect(htmlSource).toContain('var(--ag-background-primary)');
    expect(htmlSource).toContain('var(--ag-text-primary)');
    expect(htmlSource).toContain('var(--ag-space-4)');
    expect(htmlSource).toContain('var(--ag-space-6)');
    expect(htmlSource).toContain('var(--ag-space-8)');
    expect(htmlSource).toContain('var(--ag-radius-md)');
    expect(htmlSource).toMatch(/\.fixture-stack\s*\{[^}]*gap:\s*var\(--ag-space-8\)/s);
    expect(htmlSource).toMatch(/#a2ui-unlabeled-close-btn\s*\{[^}]*var\(--ag-background-tertiary\)/s);
    expect(htmlSource).toMatch(/#a2ui-unlabeled-close-btn\s*\{[^}]*var\(--ag-font-size-sm\)/s);
    expect(htmlSource).toMatch(/#a2ui-source-mapped-link\s*\{[^}]*var\(--ag-primary-text\)/s);
    expect(htmlSource).toMatch(/#a2ui-source-mapped-link\s*\{[^}]*var\(--ag-font-size-sm\)/s);
    expect(htmlSource).toContain('id="theme-toggle"');
    expect(htmlSource).toContain('<ag-card');
    expect(htmlSource).toContain('<ag-input');
    expect(htmlSource).toContain('<ag-button');
    expect(htmlSource).toContain('id="contrast-token-trap"');
    expect(htmlSource).toContain('id="overflow-trap-box"');
    expect(htmlSource).toContain('id="cls-trap-slot"');
  });

  it('==> Should serve #contrast-token-trap from source-mapped playground/src/traps.css', () => {
    const trapsCssPath = resolve(process.cwd(), 'playground/src/traps.css');
    const trapsCssSource = readFileSync(trapsCssPath, 'utf8');
    const mainTsPath = resolve(process.cwd(), 'playground/src/main.ts');
    const mainTsSource = readFileSync(mainTsPath, 'utf8');
    const viteConfigPath = resolve(process.cwd(), 'playground/vite.config.ts');
    const viteConfigSource = readFileSync(viteConfigPath, 'utf8');
    const htmlPath = resolve(process.cwd(), 'playground/index.html');
    const htmlSource = readFileSync(htmlPath, 'utf8');

    expect(trapsCssSource).toContain('#contrast-token-trap');
    expect(trapsCssSource).toContain('#f3f4f6');
    expect(trapsCssSource).toContain('#9ca3af');
    expect(mainTsSource).toContain("import './traps.css';");
    expect(viteConfigSource).toContain('devSourcemap: true');
    expect(htmlSource).not.toMatch(/#contrast-token-trap\s*\{/);
  });

  it('==> Should provide a valid config/default_tokens.json scale for out-of-the-box CLI DX and document the 3-step playground walkthrough in README.md', () => {
    const defaultTokensPath = resolve(process.cwd(), 'config/default_tokens.json');
    const parsedTokens = JSON.parse(readFileSync(defaultTokensPath, 'utf8')) as {
      colors: Record<string, string>;
      spacing: Record<string, string>;
      fontSizes: Record<string, string>;
      radii: Record<string, string>;
    };
    expect(Object.keys(parsedTokens.colors).length).toBeGreaterThan(0);
    expect(Object.keys(parsedTokens.spacing).length).toBeGreaterThan(0);
    expect(Object.keys(parsedTokens.fontSizes).length).toBeGreaterThan(0);
    expect(Object.keys(parsedTokens.radii).length).toBeGreaterThan(0);

    const readmePath = resolve(process.cwd(), 'README.md');
    const readmeSource = readFileSync(readmePath, 'utf8');

    expect(readmeSource).toContain('### 5. Local Development & Playground');
    expect(readmeSource).toContain('npm run playground:dev');
    expect(readmeSource).toContain('http://localhost:5173');
    expect(readmeSource).toContain('playground/src/traps.css');
    expect(readmeSource).toContain('npm run uirig -- check http://localhost:5173 --json');
    expect(readmeSource).toContain('npm run uirig -- check http://localhost:5173 --themes light,dark');
    expect(readmeSource).toContain('npm run uirig -- check http://localhost:5173 --fix');
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
      const injectedBanner = appendedChildren.at(0);
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

  it('==> Should format a color-coded terminal report with file:line, hostComponent, A2UI details, suggestedToken, dark-mode details, unifiedDiff, and Try Next footer while respecting NO_COLOR', () => {
    const sampleReport: ISpotCheckReport = {
      lightMode: {
        tokenViolations: [
          {
            selector: 'div#contrast-token-trap',
            hostComponent: 'ag-card',
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
            suggestedToken: 'var(--ag-text-secondary)',
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
        domViolations: [
          {
            rule: 'unlabeled_control',
            selector: 'button#a2ui-unlabeled-close-btn',
            detail: '<button> has no visible text content and no aria-label.',
            inShadowDom: false,
          },
        ],
      },
      darkMode: {
        activeThemeAttr: 'dark',
        contrastViolations: [
          {
            selector: 'div#contrast-token-trap',
            foregroundRgb: 'rgb(156, 163, 175)',
            backgroundRgb: 'rgb(243, 244, 246)',
            contrastRatio: 2.54,
            inShadowDom: false,
          },
        ],
      },
      v030Diagnostics: {
        a2uiAttributions: {
          'button#a2ui-unlabeled-close-btn': {
            surfaceId: 'playground-support-ticket',
            a2uiComponentId: 'close-ticket-btn',
            a2uiComponentType: 'IconButton',
            catalogId: 'agnosticui-v1',
            wirePath: '/components/0',
            suggestedPatch: null,
          },
        },
        sourceLocations: {
          'div#contrast-token-trap': {
            sourceFile: 'playground/src/traps.css',
            lineNumber: 5,
            columnNumber: 3,
          },
        },
        generatedUnifiedDiffs: [
          '--- a/playground/index.html\n+++ b/playground/index.html\n@@ -225,1 +225,1 @@\n- href="javascript:void(0)"\n+ href="#"',
        ],
      },
    };

    const previousNoColor = process.env.NO_COLOR;
    try {
      delete process.env.NO_COLOR;
      const coloredSummary = formatSpotCheckSummary(sampleReport);
      expect(coloredSummary).toContain('\x1b[');
      expect(coloredSummary).toContain('uirig Live 6-Tool + v0.3.0 Check Report');
      expect(coloredSummary).toContain('playground/src/traps.css:5');
      expect(coloredSummary).toContain('in <ag-card>');
      expect(coloredSummary).toContain('var(--ag-text-secondary)');
      expect(coloredSummary).toContain('playground-support-ticket/close-ticket-btn');
      expect(coloredSummary).toContain('div#contrast-token-trap');
      expect(coloredSummary).toContain('hint:');
      expect(coloredSummary).toContain('--- a/playground/index.html');
      expect(coloredSummary).toContain('Try Next (Sections 2 & 3 above are intentional adversarial traps):');
      expect(coloredSummary).toContain('npm run uirig -- check http://localhost:5173 --json');
      expect(coloredSummary).toContain('npm run uirig -- check http://localhost:5173 --themes light,dark');
      expect(coloredSummary).toContain('npm run uirig -- check http://localhost:5173 --fix');

      process.env.NO_COLOR = '1';
      const plainSummary = formatSpotCheckSummary(sampleReport);
      expect(plainSummary).not.toContain('\x1b[');
      expect(plainSummary).toContain('3. [dark-mode] Dark Mode (dark) Parity  : 1 FAIL');
      expect(plainSummary).toContain('div#contrast-token-trap (2.54:1 < 4.5:1');
      expect(plainSummary).toContain('div#contrast-token-trap (fontSize: 13px)');
      expect(plainSummary).toContain('playground/src/traps.css:5');
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
